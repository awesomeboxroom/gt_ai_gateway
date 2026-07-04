import { defineStore } from 'pinia';
import { ref } from 'vue';
import { status } from '@/api/system';
import type { RunMode } from '@/types/system';
import packageJson from '../../package.json';

const FALLBACK_VERSION = packageJson.version;

export const useAppStore = defineStore('app', () => {
    const sidebarCollapsed = ref(false);
    const version = ref(FALLBACK_VERSION);
    // 运行模式（来自 /status.json 的 mode 字段），未加载前为空字符串
    const mode = ref<RunMode | ''>('');
    const isDeveloperMode = ref(localStorage.getItem('developerMode') === 'true');

    function toggleSidebar() {
        sidebarCollapsed.value = !sidebarCollapsed.value;
    }

    function enableDeveloperMode() {
        isDeveloperMode.value = true;
        localStorage.setItem('developerMode', 'true');
    }

    function disableDeveloperMode() {
        isDeveloperMode.value = false;
        localStorage.removeItem('developerMode');
    }

    async function fetchVersion() {
        try {
            const data = await status();
            version.value = data.system?.version || FALLBACK_VERSION;
            mode.value = data.mode || '';
        } catch (error) {
            console.error('Failed to fetch version:', error);
        }
    }

    return {
        sidebarCollapsed,
        version,
        mode,
        isDeveloperMode,
        toggleSidebar,
        enableDeveloperMode,
        disableDeveloperMode,
        fetchVersion,
    };
});
