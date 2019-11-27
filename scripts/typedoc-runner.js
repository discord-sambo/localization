/* eslint-disable @typescript-eslint/typedef */

const { Application } = require('typedoc');

const app = new Application({
	tsconfig: 'tsconfig.json',
	target: 'es2017',
	mode: 'file',
	module: 'commonjs',
	theme: 'node_modules/@discord-sambo/typedoc-themes/bin/minimal',
	exclude: './**/+(node_modules|__test__|)/**/*.ts',
	excludePrivate: true,
	out: '../docs'
});

app.options.addDeclaration({ name: 'links', type: 'Array' });
app.options.setValue(
	'links',
	[
		{
			label: 'Command',
			url: 'https://discord-sambo.github.io/command/docs'
		},
		{
			label: 'Localization',
			url: 'https://discord-sambo.github.io/localization/docs',
			current: true
		},
		{
			label: 'Logger',
			url: 'https://discord-sambo.github.io/logger/docs'
		}
	]
);

const project = app.convert(app.expandInputFiles(['src']));

if (typeof project !== 'undefined')
	app.generateDocs(project, app.options.getValue('out'));
