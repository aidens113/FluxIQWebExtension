export class IoRegistry {
    inputs = new Map();
    outputs = new Map();
    register(registration) {
        for (const input of registration.inputs ?? []) {
            this.registerInput(registration.domainId, input);
        }
        for (const output of registration.outputs ?? []) {
            this.registerOutput(registration.domainId, output);
        }
    }
    registerInput(domainId, adapter) {
        const key = ioKey(domainId, adapter.definition.id);
        if (this.inputs.has(key)) {
            throw new Error(`Duplicate input adapter: ${key}`);
        }
        this.inputs.set(key, adapter);
    }
    registerOutput(domainId, adapter) {
        const key = ioKey(domainId, adapter.definition.id);
        if (this.outputs.has(key)) {
            throw new Error(`Duplicate output adapter: ${key}`);
        }
        this.outputs.set(key, adapter);
    }
    async readInput(request) {
        const adapter = this.inputs.get(ioKey(request.domainId, request.inputId));
        if (!adapter?.read) {
            throw new Error(`Input is not readable on demand: ${ioKey(request.domainId, request.inputId)}`);
        }
        return adapter.read(request);
    }
    subscribeInput(domainId, inputId, handler) {
        const adapter = this.inputs.get(ioKey(domainId, inputId));
        if (!adapter?.subscribe) {
            throw new Error(`Input is not streamable: ${ioKey(domainId, inputId)}`);
        }
        return adapter.subscribe(handler);
    }
    async dispatchOutput(request) {
        const adapter = this.outputs.get(ioKey(request.domainId, request.outputId));
        if (!adapter) {
            throw new Error(`Output adapter not found: ${ioKey(request.domainId, request.outputId)}`);
        }
        return adapter.dispatch(request);
    }
    subscribeOutput(domainId, outputId, handler) {
        const adapter = this.outputs.get(ioKey(domainId, outputId));
        if (!adapter?.subscribe) {
            throw new Error(`Output does not publish events: ${ioKey(domainId, outputId)}`);
        }
        return adapter.subscribe(handler);
    }
    inputIds(domainId) {
        return idsForDomain(this.inputs.keys(), domainId);
    }
    outputIds(domainId) {
        return idsForDomain(this.outputs.keys(), domainId);
    }
    hasInput(domainId, inputId) {
        return this.inputs.has(ioKey(domainId, inputId));
    }
    hasOutput(domainId, outputId) {
        return this.outputs.has(ioKey(domainId, outputId));
    }
    snapshot(domainId) {
        return {
            inputs: adapterSummaries(this.inputs, domainId),
            outputs: adapterSummaries(this.outputs, domainId)
        };
    }
}
export function validateDomainIo(manifest, registry) {
    const issues = [];
    const domainId = manifest.id;
    const registeredInputs = new Set(registry.inputIds(domainId));
    const registeredOutputs = new Set(registry.outputIds(domainId));
    for (const input of manifest.inputs ?? []) {
        if (!registeredInputs.has(input.id)) {
            issues.push({
                severity: "error",
                code: "domain.input.adapter_missing",
                message: `Domain input '${input.id}' has no registered adapter`,
                domainId,
                ioId: input.id
            });
        }
    }
    for (const output of manifest.outputs ?? []) {
        if (!registeredOutputs.has(output.id)) {
            issues.push({
                severity: "error",
                code: "domain.output.adapter_missing",
                message: `Domain output '${output.id}' has no registered adapter`,
                domainId,
                ioId: output.id
            });
        }
    }
    return issues;
}
export function validateIoRequirements(params) {
    const issues = [];
    for (const inputId of params.requiredInputs ?? []) {
        if (!params.registry.hasInput(params.domainId, inputId)) {
            const issue = {
                severity: "error",
                code: "runtime.input.required_missing",
                message: `Required input '${inputId}' is not registered`,
                domainId: params.domainId ?? null,
                ioId: inputId
            };
            if (params.source) {
                issue.source = params.source;
            }
            issues.push(issue);
        }
    }
    for (const outputId of params.requiredOutputs ?? []) {
        if (!params.registry.hasOutput(params.domainId, outputId)) {
            const issue = {
                severity: "error",
                code: "runtime.output.required_missing",
                message: `Required output '${outputId}' is not registered`,
                domainId: params.domainId ?? null,
                ioId: outputId
            };
            if (params.source) {
                issue.source = params.source;
            }
            issues.push(issue);
        }
    }
    return issues;
}
export function createEnvelope(params) {
    const envelope = {
        id: `${normalizeDomainId(params.domainId)}:${normalizeIoId(params.ioId)}:${params.sequence ?? 1}`,
        domainId: params.domainId ?? null,
        ioId: normalizeIoId(params.ioId),
        sequence: params.sequence ?? 1,
        timestampMs: params.timestampMs ?? Date.now(),
        payload: params.payload
    };
    if (params.metadata) {
        envelope.metadata = params.metadata;
    }
    return envelope;
}
function ioKey(domainId, ioId) {
    return `${normalizeDomainId(domainId)}:${normalizeIoId(ioId)}`;
}
function normalizeDomainId(value) {
    return value?.trim().toLowerCase() || "global";
}
function normalizeIoId(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, "_");
}
function idsForDomain(keys, domainId) {
    const prefix = `${normalizeDomainId(domainId)}:`;
    return [...keys]
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length))
        .sort();
}
function adapterSummaries(adapters, domainId) {
    const prefix = domainId === undefined ? "" : `${normalizeDomainId(domainId)}:`;
    return [...adapters.entries()]
        .filter(([key]) => !prefix || key.startsWith(prefix))
        .map(([key, adapter]) => {
        const [domain = "global", ioId = ""] = key.split(":", 2);
        const summary = {
            domainId: domain === "global" ? null : domain,
            ioId,
            title: adapter.definition.title,
            mode: adapter.mode
        };
        if (adapter.definition.description) {
            summary.description = adapter.definition.description;
        }
        return summary;
    })
        .sort((left, right) => `${left.domainId ?? "global"}:${left.ioId}`.localeCompare(`${right.domainId ?? "global"}:${right.ioId}`));
}
