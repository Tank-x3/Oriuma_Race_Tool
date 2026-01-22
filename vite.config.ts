/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pagesなどでリポジトリ名を含むURL (https://user.github.io/repo/) で公開する場合、
  // そのリポジトリ名を設定してください。例: base: '/my-repo-name/'
  // デフォルトの '/' だと、アセットの読み込みパスがルート直下になり、サブディレクトリで動かない場合があります。
  // 一旦相対パス './' に設定しておくと、多くの環境で動作します。
  base: './',
  plugins: [react()],
})
