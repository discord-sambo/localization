import { LocalizationStringChildNode } from '@/interfaces/LocalizationStringChildNode';
import { LocalizationStringNodeKind } from '@/types/LocalizationStringNodeKind';
import { LocalizationStringTypeDeclarationMapping } from '@/types/LocalizationStringTypeDeclarationMapping';

/**
 * Interface for an abstract Localization resource parent node
 * @internal
 */
export interface LocalizationStringParentNode
{
	kind: LocalizationStringNodeKind;
	container: string;
	key: string;
	category: string;
	subcategory: string;
	children: LocalizationStringChildNode[];
	params: LocalizationStringTypeDeclarationMapping;
	line: number;
	column: number;
}
