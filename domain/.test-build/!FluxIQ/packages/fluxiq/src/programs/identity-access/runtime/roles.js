export const adminRole = {
    id: "admin",
    permissions: [
        "programs.read",
        "programs.write",
        "flows.write",
        "runtime.control",
        "compute.control",
        "identity.manage",
        "data.manage"
    ]
};
export const viewerRole = {
    id: "viewer",
    permissions: ["programs.read"]
};
export const defaultRoles = [adminRole, viewerRole];
