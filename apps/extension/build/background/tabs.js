export async function activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab ? describeTab(tab) : undefined;
}
export async function allTabs() {
    const tabs = await chrome.tabs.query({});
    return tabs.map(describeTab);
}
export function describeTab(tab) {
    const descriptor = {
        tabId: tab.id ?? -1
    };
    if (tab.windowId !== undefined)
        descriptor.windowId = tab.windowId;
    if (tab.url)
        descriptor.url = tab.url;
    if (tab.title)
        descriptor.title = tab.title;
    if (tab.favIconUrl)
        descriptor.favIconUrl = tab.favIconUrl;
    if (tab.active !== undefined)
        descriptor.active = tab.active;
    if (tab.status)
        descriptor.status = tab.status;
    return descriptor;
}
export async function sendToTab(tabId, message, frameId) {
    return new Promise((resolve, reject) => {
        const callback = (response) => {
            const error = chrome.runtime.lastError;
            if (error)
                reject(new Error(error.message));
            else
                resolve(response);
        };
        if (frameId !== undefined)
            chrome.tabs.sendMessage(tabId, message, { frameId }, callback);
        else
            chrome.tabs.sendMessage(tabId, message, callback);
    });
}
//# sourceMappingURL=tabs.js.map