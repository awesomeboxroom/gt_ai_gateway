<template>
    <div class="app-header">
        <div class="header-left">
            <img src="/favicon.svg" alt="Logo" class="logo" />
            <span class="title">{{ title }}</span>
        </div>
        <div class="header-right">
            <a-dropdown>
                <a-button type="text" class="user-btn">
                    <UserOutlined />
                    <span class="username">{{ authStore.userType || 'Admin' }}</span>
                </a-button>
                <template #overlay>
                    <a-menu>
                        <a-menu-item @click="handleLogout">
                            <LogoutOutlined />
                            <span>退出登录</span>
                        </a-menu-item>
                    </a-menu>
                </template>
            </a-dropdown>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { message } from 'ant-design-vue';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons-vue';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const title = computed(() => {
    return 'AI Gateway';
});

function handleLogout() {
    authStore.logout();
    message.success('已退出登录');
    router.push('/login');
}
</script>

<style scoped>
.app-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 24px;
    height: 64px;
    background: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 20;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.logo {
    width: 32px;
    height: 32px;
    object-fit: contain;
}

.title {
    font-size: 18px;
    font-weight: 600;
}

.header-right {
    display: flex;
    align-items: center;
}

.user-btn {
    display: flex;
    align-items: center;
    gap: 8px;
}

.username {
    font-size: 14px;
}
</style>
