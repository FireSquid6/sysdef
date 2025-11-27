// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Sysdef Docs',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/firesquid6/sysdef' }],
			sidebar: [
				{
					label: 'Documentation',
          autogenerate: { directory: 'documentation' },
				},
			],
		}),
	],
});
