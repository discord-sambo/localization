/**
 * Represnts the kinds of templates we can expect to encounter within a
 * Localization resource
 * @internal
 */
export enum LocalizationStringTemplateKind
{
	Regular,
	Optional,
	Forward,
	Script,
	Invalid
}
