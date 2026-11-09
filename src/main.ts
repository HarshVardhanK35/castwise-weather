import { createApp } from 'vue'
import './style.css'
import { installLegacyShims } from './legacyShims'
import App from "./App.vue"

installLegacyShims()
createApp(App).mount('#app')
