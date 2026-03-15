<template>
    <div class="token-display">
        <span v-if="showFull">{{ token }}</span>
        <span v-else>{{ maskedToken }}</span>
        <a-button
            type="link"
            size="small"
            class="icon-button"
            :title="showFull ? '隐藏 Token' : '显示 Token'"
            @click="toggle"
        >
            <template #icon>
                <EyeInvisibleOutlined v-if="showFull" />
                <EyeOutlined v-else />
            </template>
        </a-button>
        <a-button
            type="link"
            size="small"
            class="icon-button"
            title="复制 Token"
            @click="copyToken"
        >
            <template #icon>
                <CopyOutlined />
            </template>
        </a-button>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { message } from 'ant-design-vue/es';
import { CopyOutlined, EyeInvisibleOutlined, EyeOutlined } from '@ant-design/icons-vue';

interface Props {
    token: string;
}

const props = defineProps<Props>();

const showFull = ref(false);

const maskedToken = computed(() => {
    if (!props.token) return '';
    if (props.token.length <= 8) return '****';
    return `${props.token.slice(0, 4)}...${props.token.slice(-4)}`;
});

function toggle() {
    showFull.value = !showFull.value;
}

function copyToken() {
    navigator.clipboard.writeText(props.token).then(() => {
        message.success('已复制到剪贴板');
    });
}
</script>

<style scoped>
.token-display {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.icon-button {
    padding-inline: 4px;
}
</style>
