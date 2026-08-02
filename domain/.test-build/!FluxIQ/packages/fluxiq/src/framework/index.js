import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DomainRegistry, domainSummary } from "../domains";
import { IoRegistry, validateDomainIo, validateIoRequirements } from "../io";
import { buildProgramDirectory, createGlobalProgramRuntime, registerHostDocumentationGenerators } from "../programs";
const DEFAULT_FLUXIQ_DIR = ".fluxiq";
export class FluxIQ {
    paths;
    domains = new DomainRegistry();
    io = new IoRegistry();
    programs;
    constructor(options = {}) {
        const cwd = process.cwd();
        if (options.loadEnv ?? true) {
            loadFluxIQEnv(envLoadOptions(cwd, options.envFiles));
        }
        const env = process.env;
        const root = path.resolve(options.rootDir ?? cleanEnv(env.FLUXIQ_ROOT) ?? process.cwd());
        if ((options.loadEnv ?? true) && root !== cwd) {
            loadFluxIQEnv(envLoadOptions(root, options.envFiles));
        }
        const fluxiqDir = options.fluxiqDir ?? cleanEnv(env.FLUXIQ_DIR) ?? DEFAULT_FLUXIQ_DIR;
        const fluxiq = resolveInside(root, fluxiqDir);
        this.paths = {
            root,
            fluxiq,
            config: resolveInside(root, path.join(fluxiqDir, "config")),
            data: resolveInside(root, options.dataDir ?? cleanEnv(env.FLUXIQ_DATA_DIR) ?? path.join(fluxiqDir, "data")),
            databases: resolveInside(root, options.databasesDir ?? cleanEnv(env.FLUXIQ_DATABASES_DIR) ?? path.join(fluxiqDir, "databases")),
            inputs: resolveInside(root, options.inputsDir ?? cleanEnv(env.FLUXIQ_INPUTS_DIR) ?? path.join(fluxiqDir, "inputs")),
            outputs: resolveInside(root, options.outputsDir ?? cleanEnv(env.FLUXIQ_OUTPUTS_DIR) ?? path.join(fluxiqDir, "outputs")),
            streams: resolveInside(root, options.streamsDir ?? cleanEnv(env.FLUXIQ_STREAMS_DIR) ?? path.join(fluxiqDir, "streams")),
            domains: resolveInside(root, options.domainsDir ?? cleanEnv(env.FLUXIQ_DOMAINS_DIR) ?? path.join(fluxiqDir, "domains")),
            domainPrograms: resolveInside(root, options.domainProgramsDir ?? cleanEnv(env.FLUXIQ_DOMAIN_PROGRAMS_DIR) ?? path.join(fluxiqDir, "domains", "programs")),
            domainInputs: resolveInside(root, options.domainInputsDir ?? cleanEnv(env.FLUXIQ_DOMAIN_INPUTS_DIR) ?? path.join(fluxiqDir, "domains", "inputs")),
            domainOutputs: resolveInside(root, options.domainOutputsDir ?? cleanEnv(env.FLUXIQ_DOMAIN_OUTPUTS_DIR) ?? path.join(fluxiqDir, "domains", "outputs")),
            domainConfigs: resolveInside(root, options.domainConfigsDir ?? cleanEnv(env.FLUXIQ_DOMAIN_CONFIGS_DIR) ?? path.join(fluxiqDir, "domains", "configs")),
            domainData: resolveInside(root, options.domainDataDir ?? cleanEnv(env.FLUXIQ_DOMAIN_DATA_DIR) ?? path.join(fluxiqDir, "domains", "data")),
            domainDatabases: resolveInside(root, options.domainDatabasesDir ?? cleanEnv(env.FLUXIQ_DOMAIN_DATABASES_DIR) ?? path.join(fluxiqDir, "domains", "databases")),
            recordings: resolveInside(root, options.recordingsDir ?? cleanEnv(env.FLUXIQ_RECORDINGS_DIR) ?? path.join(fluxiqDir, "recordings")),
            policies: resolveInside(root, options.policiesDir ?? cleanEnv(env.FLUXIQ_POLICIES_DIR) ?? path.join(fluxiqDir, "policies")),
            logs: resolveInside(root, options.logsDir ?? cleanEnv(env.FLUXIQ_LOGS_DIR) ?? path.join(fluxiqDir, "logs")),
            temp: resolveInside(root, options.tempDir ?? cleanEnv(env.FLUXIQ_TEMP_DIR) ?? path.join(fluxiqDir, "tmp"))
        };
        this.programs = createGlobalProgramRuntime(this.paths);
        for (const domain of options.domains ?? []) {
            this.domains.register(domain);
        }
        for (const registration of options.io ?? []) {
            this.io.register(registration);
        }
        registerHostDocumentationGenerators({
            docs: this.programs.docs,
            providers: {
                domains: () => this.domains.all(),
                io: () => this.io.snapshot()
            }
        });
    }
    static create(options = {}) {
        return new FluxIQ(options);
    }
    registerDomain(registration) {
        this.domains.register(registration);
        return this;
    }
    registerIo(registration) {
        this.io.register(registration);
        return this;
    }
    ioSnapshot(domainId) {
        return this.io.snapshot(domainId);
    }
    validateDomainIo(domainId) {
        const domain = this.domains.maybeGet(domainId);
        if (!domain) {
            return [{
                    severity: "error",
                    code: "domain.unknown",
                    message: `Unknown domain: ${domainId}`,
                    domainId
                }];
        }
        return validateDomainIo(domain.manifest, this.io);
    }
    validateIoRequirements(params) {
        const request = {
            registry: this.io
        };
        if (params.domainId !== undefined) {
            request.domainId = params.domainId;
        }
        if (params.requiredInputs) {
            request.requiredInputs = params.requiredInputs;
        }
        if (params.requiredOutputs) {
            request.requiredOutputs = params.requiredOutputs;
        }
        if (params.source) {
            request.source = params.source;
        }
        return validateIoRequirements(request);
    }
    validateComponentIo(domainId, components) {
        return components.specs().flatMap((spec) => {
            const params = { source: spec.nodeType };
            if (domainId !== undefined) {
                params.domainId = domainId;
            }
            if (spec.requiredInputs) {
                params.requiredInputs = spec.requiredInputs;
            }
            if (spec.requiredOutputs) {
                params.requiredOutputs = spec.requiredOutputs;
            }
            return this.validateIoRequirements(params);
        });
    }
    programDirectory(domainId) {
        const domain = this.domains.maybeGet(domainId);
        return buildProgramDirectory({
            scope: { domainId: domain?.manifest.id ?? null },
            domains: this.domains.summaries(),
            domain: domain ? domainSummary(domain.manifest) : null,
            domainProgramRoot: this.paths.domainPrograms
        });
    }
    async setup(options = {}) {
        const created = [];
        const directories = [
            this.paths.fluxiq,
            this.paths.config,
            this.paths.data,
            this.paths.databases,
            this.paths.inputs,
            this.paths.outputs,
            this.paths.streams,
            this.paths.domains,
            this.paths.domainPrograms,
            this.paths.domainInputs,
            this.paths.domainOutputs,
            this.paths.domainConfigs,
            this.paths.domainData,
            this.paths.domainDatabases,
            this.paths.recordings,
            this.paths.policies,
            this.paths.logs,
            this.paths.temp
        ];
        for (const directory of directories) {
            await mkdir(directory, { recursive: true });
            created.push(directory);
            if (options.createGitkeep ?? true) {
                await ensureTextFile(path.join(directory, ".gitkeep"), "");
            }
            if (options.createGuides ?? true) {
                await ensureTextFile(path.join(directory, "README.md"), guideForDirectory(directory, this.paths));
            }
        }
        const configPath = path.join(this.paths.config, "fluxiq.config.json");
        if (options.createConfig ?? true) {
            await ensureJsonConfig(configPath, {
                version: 1,
                createdBy: "fluxiq",
                paths: {
                    fluxiq: this.paths.fluxiq,
                    config: this.paths.config,
                    data: this.paths.data,
                    databases: this.paths.databases,
                    inputs: this.paths.inputs,
                    outputs: this.paths.outputs,
                    streams: this.paths.streams,
                    domains: this.paths.domains,
                    domainPrograms: this.paths.domainPrograms,
                    domainInputs: this.paths.domainInputs,
                    domainOutputs: this.paths.domainOutputs,
                    domainConfigs: this.paths.domainConfigs,
                    domainData: this.paths.domainData,
                    domainDatabases: this.paths.domainDatabases,
                    recordings: this.paths.recordings,
                    policies: this.paths.policies,
                    logs: this.paths.logs,
                    temp: this.paths.temp
                }
            });
        }
        return { paths: this.paths, created, configPath };
    }
}
export function loadFluxIQEnv(options = {}) {
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const files = options.files ?? [".env", ".env.local"];
    for (const file of files) {
        loadEnvFileIfPresent(path.resolve(cwd, file), options.override ?? false);
    }
}
function resolveInside(root, value) {
    return path.isAbsolute(value) ? path.resolve(value) : path.resolve(root, value);
}
function cleanEnv(value) {
    const clean = value?.trim();
    return clean ? clean : undefined;
}
function envLoadOptions(cwd, files) {
    return files ? { cwd, files } : { cwd };
}
function readTextFileIfPresent(filePath) {
    try {
        return readFileSync(filePath, "utf8");
    }
    catch {
        return "";
    }
}
function loadEnvFileIfPresent(filePath, override) {
    const content = readTextFileIfPresent(filePath);
    for (const [key, value] of parseEnv(content)) {
        if (!override && process.env[key] !== undefined)
            continue;
        process.env[key] = value;
    }
}
function parseEnv(content) {
    const rows = [];
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#"))
            continue;
        const assignment = line.startsWith("export ") ? line.slice(7).trim() : line;
        const equalsIndex = assignment.indexOf("=");
        if (equalsIndex <= 0)
            continue;
        const key = assignment.slice(0, equalsIndex).trim();
        const value = unquoteEnvValue(assignment.slice(equalsIndex + 1).trim());
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
            rows.push([key, value]);
        }
    }
    return rows;
}
function unquoteEnvValue(value) {
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    const commentIndex = value.indexOf(" #");
    return commentIndex >= 0 ? value.slice(0, commentIndex).trim() : value;
}
async function ensureJsonConfig(filePath, config) {
    try {
        await readFile(filePath, "utf8");
        return;
    }
    catch {
        await writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    }
}
async function ensureTextFile(filePath, content) {
    try {
        await readFile(filePath, "utf8");
        return;
    }
    catch {
        await writeFile(filePath, content, "utf8");
    }
}
function guideForDirectory(directory, paths) {
    const normalized = path.resolve(directory);
    const guideEntries = [
        [paths.fluxiq, "FluxIQ runtime state, generated artifacts, and host-local framework files live under this root.\n"],
        [paths.config, "Host-project FluxIQ configuration files live here.\n"],
        [paths.data, "Framework-managed JSON data and repository state live here.\n"],
        [paths.databases, "Framework-managed database files and migration state live here.\n"],
        [paths.inputs, "Runtime input cache/snapshots received by FluxIQ live here.\n"],
        [paths.outputs, "Runtime output dispatch logs and output artifacts live here.\n"],
        [paths.streams, "Stream checkpoints, cursors, and event buffers live here.\n"],
        [paths.domains, "Host-project domain code and domain-owned resources live under this root.\n"],
        [paths.domainPrograms, "Domain-specific programs owned by the host project live here.\n"],
        [paths.domainInputs, "Domain input definitions, adapters, and fixtures owned by the host project live here.\n"],
        [paths.domainOutputs, "Domain output definitions, adapters, and fixtures owned by the host project live here.\n"],
        [paths.domainConfigs, "Domain configuration files owned by the host project live here.\n"],
        [paths.domainData, "Domain-owned data files live here.\n"],
        [paths.domainDatabases, "Domain-owned database files and migrations live here.\n"],
        [paths.recordings, "Automation Studio recordings generated by the host project live here.\n"],
        [paths.policies, "Generated policies and policy build artifacts live here.\n"],
        [paths.logs, "FluxIQ runtime and framework logs live here.\n"],
        [paths.temp, "Temporary FluxIQ working files live here.\n"]
    ];
    const guides = new Map(guideEntries.map(([key, value]) => [path.resolve(key), value]));
    return guides.get(normalized) ?? "FluxIQ host-project folder.\n";
}
