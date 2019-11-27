import { Localization } from './Localization';
import { LocalizationResrouceMetaData } from './types/LocalizationResourceMetaData';
import { LocalizationStringChildNode } from './interfaces/LocalizationStringChildNode';
import { LocalizationStringChildResultNode } from './types/LocalizationStringChildResultNode';
import { LocalizationStringError } from './LocalizationStringError';
import { LocalizationStringNodeKind } from './types/LocalizationStringNodeKind';
import { LocalizationStringParentNode } from './interfaces/LocalizationStringParentNode';
import { LocalizationStringTypeDeclaration } from './types/LocalizationStringTypeDeclaration';
import { NodeKindImplForwardTemplate } from './nodeKindImpl/NodeKindImplForwardTemplate';
import { NodeKindImplOptionalTemplate } from './nodeKindImpl/NodeKindImplOptionalTemplate';
import { NodeKindImplRegularTemplate } from './nodeKindImpl/NodeKindImplRegularTemplate';
import { NodeKindImplScriptTemplate } from './nodeKindImpl/NodeKindImplScriptTemplate';
import { NodeKindImplStringChunk } from './nodeKindImpl/NodeKindImplStringChunk';
import { TemplateArguments } from './types/TemplateArguments';

/**
 * Stores a localization string parent node and builds a string
 * from it on demand
 * @internal
 */
export class LocalizationStringBuilder
{
	private _language: string;

	public node: LocalizationStringParentNode;

	public constructor(language: string, input: LocalizationStringParentNode)
	{
		this.node = input;
		this._language = language;
	}

	/**
	 * Builds the output string from the cached Localization string node
	 */
	public build(args: TemplateArguments, _meta: LocalizationResrouceMetaData): string
	{
		const maybeKinds: LocalizationStringNodeKind[] = [
			LocalizationStringNodeKind.OptionalTemplate,
			LocalizationStringNodeKind.ScriptTemplate
		];

		const results: LocalizationStringChildResultNode[] = [];
		const path: [string, string, string] =
			[this._language, this.node.category, this.node.subcategory];

		// Validate passed arguments if the parent node has any param type declarations
		if (Object.keys(this.node.params).length > 0)
			this._validateArguments(args, _meta);

		// Evaluate child node results
		for (const child of this.node.children)
		{
			switch (child.kind)
			{
				case LocalizationStringNodeKind.StringChunk:
					this._childIs<NodeKindImplStringChunk>(child);
					results.push(this._makeResult(child.kind, child.content));
					break;

				case LocalizationStringNodeKind.RegularTemplate:
				case LocalizationStringNodeKind.OptionalTemplate:
					this._childIs<NodeKindImplRegularTemplate | NodeKindImplOptionalTemplate>(child);
					results.push(this._makeResult(child.kind, args[child.key]));
					break;

				case LocalizationStringNodeKind.ForwardTemplate:
					this._childIs<NodeKindImplForwardTemplate>(child);

					if (!Localization.resourceExists(path, child.forwardKey))
						throw new LocalizationStringError(
							[
								`Localization string key '${child.forwardKey}'`,
								`does not exist for language '${this._language}'`
							].join(' '),
							this.node.container,
							child.line,
							child.column,
							_meta
						);

					// Recursion protection. Will work as long as _meta is forwarded.
					// If not, may the Node gods have mercy on your code
					if (_meta._cc?.includes(child.forwardKey))
						throw new LocalizationStringError(
							'A localization resource cannot refer to any previous parent',
							this.node.container,
							child.line,
							child.column,
							_meta
						);

					results.push(this._makeResult(
						child.kind,
						(Localization.resource as any)(path, child.forwardKey, args, _meta)
					));

					break;

				case LocalizationStringNodeKind.ScriptTemplate:
					this._childIs<NodeKindImplScriptTemplate>(child);
					results.push(this._makeResult(child.kind, child.fn(args, _meta)?.toString()));
			}
		}

		// Handle isolated optional templates and script templates with undefined values
		for (const [i, result] of results.entries())
		{
			if (!maybeKinds.includes(result.kind))
				continue;

			const prev: LocalizationStringChildResultNode = results[i - 1];
			const next: LocalizationStringChildResultNode = results[i + 1];
			if (this._isIsolatedMaybeResult(prev, next) && typeof result.value === 'undefined')
			{
				// Remove the leading newline from the next node to compensate
				// for the undefined value of the current node
				next.value = next.value?.replace(/^\n/, '');
				result.value = '';
			}
		}

		// Handle remaining non-isolated optional and script templates with undefined values
		for (const result of results)
			if (maybeKinds.includes(result.kind) && typeof result.value === 'undefined')
				result.value = '';

		return results
			.map(r => `${r.value}`)
			.join('')
			.trim();
	}

	/**
	 * Validate the given arguments in the context of the cached parent node,
	 * erroring on invalid types and missing required arguments
	 */
	private _validateArguments(args: TemplateArguments, _meta: LocalizationResrouceMetaData): void
	{
		for (const ident of Object.keys(this.node.params))
		{
			const declaration: LocalizationStringTypeDeclaration = this.node.params[ident];
			const expectedType: string = `${declaration.identType}${declaration.isArrayType ? '[]' : ''}`;

			if (declaration.isOptional && typeof args[ident] === 'undefined')
				continue;

			if (typeof args[ident] === 'undefined')
				throw new LocalizationStringError(
					`Expected type '${expectedType}', got undefined`,
					this.node.container,
					declaration.line,
					declaration.column,
					_meta
				);

			if (declaration.isArrayType)
			{
				if (!Array.isArray(args[ident]))
					throw new LocalizationStringError(
						`Expected array type, got ${typeof args[ident]}`,
						this.node.container,
						declaration.line,
						declaration.column,
						_meta
					);

				for (const arg of args[ident])
					this._validateType(declaration, arg, _meta);
			}
			else
			{
				this._validateType(declaration, args[ident], _meta);
			}
		}
	}

	/**
	 * Validate the type of the given value based on the given declaration
	 */
	private _validateType(
		declaration: LocalizationStringTypeDeclaration,
		value: any,
		_meta: LocalizationResrouceMetaData
	): void
	{
		if (declaration.identType === 'any' || typeof value === declaration.identType)
			return;

		throw new LocalizationStringError(
			[
				`Expected type '${declaration.identType}'`,
				`${declaration.isArrayType ? ' in array' : ''}, got ${typeof value}`
			].join(''),
			this.node.container,
			declaration.line,
			declaration.column,
			_meta
		);
	}

	/**
	 * Returns whether or not a result is valid (exists and has a value)
	 */
	private _isValidResult(result?: LocalizationStringChildResultNode): boolean
	{
		return typeof result?.value !== 'undefined' && result?.value !== '';
	}

	/**
	 * Determines whether or not we are expecting an isolated maybe
	 * result (Optional Template or Script Template) based on the
	 * previous and next result nodes
	 */
	private _isIsolatedMaybeResult(
		prev: LocalizationStringChildResultNode,
		next: LocalizationStringChildResultNode
	): boolean
	{
		if (this._isValidResult(prev) && this._isValidResult(next))
			return prev.value!.endsWith('\n') && next.value!.startsWith('\n');

		if (this._isValidResult(next))
			return next.value!.startsWith('\n');

		return false;
	}

	/**
	 * Create and return a `LocalizationStringChildResultNode`
	 */
	private _makeResult(kind: LocalizationStringNodeKind, value?: string): LocalizationStringChildResultNode
	{
		return { kind, value };
	}

	/**
	 * Asserts at compile time that the given child node is of type T
	 */
	private _childIs<T extends LocalizationStringChildNode>(
		_child: LocalizationStringChildNode
	): asserts _child is T {}
}
