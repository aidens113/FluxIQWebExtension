import type { TabDescriptor } from "../shared/protocol";
export declare function activeTab(): Promise<TabDescriptor | undefined>;
export declare function allTabs(): Promise<TabDescriptor[]>;
export declare function describeTab(tab: chrome.tabs.Tab): TabDescriptor;
export declare function sendToTab<TResponse = unknown>(tabId: number, message: unknown, frameId?: number): Promise<TResponse>;
