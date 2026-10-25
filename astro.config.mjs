import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://bl808-linux.github.io',
  trailingSlash: 'always',
  integrations: [starlight({
    title: 'BL808 Reference',
    description: 'An evidence-based hardware reference for BL808 software developers.',
    favicon: '/favicon.svg',
    social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/bl808-linux' }],
    customCss: ['./src/styles/reference.css'],
    components: { SiteTitle: './src/components/SiteTitle.astro' },
    tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
    sidebar: [
      { label: 'Overview', slug: '' },
      { label: 'Official vendor manuals', link: '/vendor/bl808/' },
      { label: 'Address space', items: [
        { label: 'Memory map', slug: 'address-space/memory-map' },
        { label: 'Core views & aliases', slug: 'address-space/core-views' },
      ] },
      { label: 'Boot & storage', items: [
        { label: 'Storage roles & boot', slug: 'storage/overview' },
        { label: 'RAM boot for development', slug: 'storage/ram-boot' },
        { label: 'SPI NOR layout & updates', slug: 'storage/flash' },
        { label: 'SD card & Linux files', slug: 'storage/sd-card' },
      ] },
      { label: 'Clocks & reset', items: [
        { label: 'Clock tree', slug: 'clocks/overview' },
        { label: 'GLB', slug: 'clocks/glb' },
        { label: 'HBN & PDS', slug: 'clocks/hbn-pds' },
        { label: 'MM_GLB', slug: 'clocks/mm-glb' },
        { label: 'C906 RTC / MTIMER', slug: 'clocks/rtc' },
        { label: 'Initialization & reset', slug: 'clocks/sequencing' },
      ] },
      { label: 'Interrupts', items: [
        { label: 'Interrupt topology', slug: 'interrupts/overview' },
        { label: 'CPU local / CLINT', slug: 'interrupts/local' },
        { label: 'PLIC', slug: 'interrupts/plic' },
        { label: 'MCU forwarding / M0IC', slug: 'interrupts/m0ic' },
        { label: 'Source map', slug: 'interrupts/sources' },
      ] },
      { label: 'UART', items: [
        { label: 'Functional description', slug: 'uart/overview' },
        { label: 'Registers', slug: 'uart/registers' },
      ] },
      { label: 'Reading guide', collapsed: true, items: [
        { label: 'Board observations', slug: 'references/observations' },
        { label: 'Reading the reference', slug: 'references/notation' },
      ] },
    ],
  })],
});
