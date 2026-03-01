// 文件服务 - 统一本地 Node.js 和 Cloudflare Worker 环境的文件读取

import { ormService } from './ormService'

// ============================================================
// Node.js 环境实现
// ============================================================

function getProjectRoot(): string {
  const { resolve, dirname } = require('path')
  const { existsSync } = require('fs')

  // 1. process.cwd() - 最常见的情况
  const cwd = process.cwd()
  if (existsSync(resolve(cwd, 'package.json'))) {
    return cwd
  }

  // 2. __filename 推导
  try {
    const currentDir = dirname(__filename)
    const root = resolve(currentDir, '../..')
    if (existsSync(resolve(root, 'package.json'))) {
      return root
    }
  } catch (_) {
    // __filename 可能不可用
  }

  // 3. fallback
  return cwd
}

async function readFileInNode(filePath: string): Promise<string> {
  const { readFileSync } = require('fs')
  const { resolve } = require('path')

  const root = getProjectRoot()
  const fullPath = resolve(root, filePath)
  return readFileSync(fullPath, 'utf-8')
}

async function listFilesInNode(dirPath: string, pattern: string): Promise<string[]> {
  const { readdirSync, existsSync } = require('fs')
  const { resolve } = require('path')

  const root = getProjectRoot()
  const fullPath = resolve(root, dirPath)

  if (!existsSync(fullPath)) {
    return []
  }

  const files: string[] = readdirSync(fullPath)

  if (pattern === '*') {
    return files
  }

  // 支持 *.ext 形式的模式
  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1) // 如 '.sql'
    return files.filter(f => f.endsWith(ext))
  }

  return files
}

// ============================================================
// Worker 环境实现
// ============================================================

// Worker 环境下的文件清单（Worker 没有真正的文件系统，需要预定义）
const WORKER_FILE_MANIFEST: Record<string, string[]> = {
  'src/resource': [
    'migrate_0001.sql',
    'migrate_0002.sql',
  ],
}

async function readFileInWorker(filePath: string): Promise<string> {
  // 将项目相对路径转换为相对于当前文件(src/service/)的路径
  let relativePath: string

  if (filePath.startsWith('src/service/')) {
    relativePath = filePath.replace('src/service/', './')
  } else if (filePath.startsWith('src/')) {
    relativePath = '../' + filePath.replace('src/', '')
  } else {
    relativePath = '../../' + filePath
  }

  const fileUrl = new URL(relativePath, import.meta.url).href

  try {
    const response = await fetch(fileUrl)
    if (!response.ok) {
      throw new Error(`Failed to load file: ${filePath} (${response.status} ${response.statusText})`)
    }
    return await response.text()
  } catch (error: any) {
    throw new Error(`Failed to read file in Worker: ${filePath} - ${error.message}`)
  }
}

async function listFilesInWorker(dirPath: string, pattern: string): Promise<string[]> {
  const files = WORKER_FILE_MANIFEST[dirPath] || []

  if (pattern === '*') {
    return files
  }

  if (pattern.startsWith('*.')) {
    const ext = pattern.slice(1)
    return files.filter(f => f.endsWith(ext))
  }

  return files
}

// ============================================================
// 统一接口
// ============================================================

/**
 * 读取文件内容
 * @param filePath 文件路径（相对于项目根目录，如 'src/resource/migrate_0001.sql'）
 * @returns 文件内容字符串
 */
export async function readFile(filePath: string): Promise<string> {
  if (ormService.isLocal) {
    return readFileInNode(filePath)
  }
  return readFileInWorker(filePath)
}

/**
 * 列出指定目录下的所有文件
 * @param dirPath 目录路径（相对于项目根目录，如 'src/resource'）
 * @param pattern 文件匹配模式（如 '*.sql'，默认为 '*'）
 * @returns 文件名列表
 */
export async function listFiles(dirPath: string, pattern: string = '*'): Promise<string[]> {
  if (ormService.isLocal) {
    return listFilesInNode(dirPath, pattern)
  }
  return listFilesInWorker(dirPath, pattern)
}

export default {
  readFile,
  listFiles,
}
