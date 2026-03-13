import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { welcome } from '@/api/system';

export const useAuthStore = defineStore('auth', () => {
    const token = ref<string>(localStorage.getItem('adminToken') || '');
    const userType = ref<string>('');
    const isLoading = ref(false);

    const isAuthenticated = computed(() => !!token.value);

    function setToken(newToken: string) {
        token.value = newToken;
        localStorage.setItem('adminToken', newToken);
    }

    function clearToken() {
        token.value = '';
        userType.value = '';
        localStorage.removeItem('adminToken');
    }

    async function validateToken(): Promise<boolean> {
        if (!token.value) return false;

        isLoading.value = true;
        try {
            const data = await welcome();
            if (data && data.user_type) {
                userType.value = data.user_type;
            } else {
                userType.value = 'admin'; // Default fallback
            }
            return true;
        } catch {
            clearToken();
            return false;
        } finally {
            isLoading.value = false;
        }
    }

    async function login(newToken: string): Promise<boolean> {
        setToken(newToken);
        return await validateToken();
    }

    function logout() {
        clearToken();
    }

    return {
        token,
        userType,
        isLoading,
        isAuthenticated,
        setToken,
        clearToken,
        validateToken,
        login,
        logout,
    };
});
