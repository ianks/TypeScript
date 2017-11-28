/* @internal */
namespace ts.codefix {
    const errorCodes = [
        Diagnostics.Non_abstract_class_0_does_not_implement_inherited_abstract_member_1_from_class_2.code,
        Diagnostics.Non_abstract_class_expression_does_not_implement_inherited_abstract_member_0_from_class_1.code,
    ];
    const groupId = "fixClassDoesntImplementInheritedAbstractMember";
    registerCodeFix({
        errorCodes,
        getCodeActions(context) {
            const { program, sourceFile, span } = context;
            const changes = textChanges.ChangeTracker.with(context, t =>
                addMissingMembers(getClass(sourceFile, span.start), sourceFile, program.getTypeChecker(), context.newLineCharacter, t));
            return changes.length === 0 ? undefined : [{ description: getLocaleSpecificMessage(Diagnostics.Implement_inherited_abstract_class), changes, groupId }];
        },
        groupIds: [groupId],
        fixAllInGroup: context => iterateErrorsForCodeActionAll(context, errorCodes, (changes, err) => {
            addMissingMembers(getClass(err.file!, err.start!), context.sourceFile, context.program.getTypeChecker(), context.newLineCharacter, changes);
        }),
    });

    function getClass(sourceFile: SourceFile, pos: number): ClassLikeDeclaration {
        // This is the identifier in the case of a class declaration
        // or the class keyword token in the case of a class expression.
        const token = getTokenAtPosition(sourceFile, pos, /*includeJsDocComment*/ false);
        const classDeclaration = token.parent;
        Debug.assert(isClassLike(classDeclaration));
        return classDeclaration as ClassLikeDeclaration;
    }

    function addMissingMembers(classDeclaration: ClassLikeDeclaration, sourceFile: SourceFile, checker: TypeChecker, newLineCharacter: string, changeTracker: textChanges.ChangeTracker): void {
        const extendsNode = getClassExtendsHeritageClauseElement(classDeclaration);
        const instantiatedExtendsType = checker.getTypeAtLocation(extendsNode);

        // Note that this is ultimately derived from a map indexed by symbol names,
        // so duplicates cannot occur.
        const abstractAndNonPrivateExtendsSymbols = checker.getPropertiesOfType(instantiatedExtendsType).filter(symbolPointsToNonPrivateAndAbstractMember);

        createMissingMemberNodes(classDeclaration, abstractAndNonPrivateExtendsSymbols, checker, addNewMemberToClass(changeTracker, sourceFile, classDeclaration, newLineCharacter));
    }

    export function addNewMemberToClass(changeTracker: textChanges.ChangeTracker, sourceFile: SourceFile, classDeclaration: ClassLikeDeclaration, newLineCharacter: string): (newNode: Node) => void {
        return newNode => {
            Debug.assert(!!newNode);
            changeTracker.insertNodeAfter(sourceFile, getOpenBraceOfClassLike(classDeclaration, sourceFile), newNode, { suffix: newLineCharacter })
        }
    }

    function symbolPointsToNonPrivateAndAbstractMember(symbol: Symbol): boolean {
        // See `codeFixClassExtendAbstractProtectedProperty.ts` in https://github.com/Microsoft/TypeScript/pull/11547/files
        // (now named `codeFixClassExtendAbstractPrivateProperty.ts`)
        const flags = getModifierFlags(first(symbol.getDeclarations()));
        return !(flags & ModifierFlags.Private) && !!(flags & ModifierFlags.Abstract);
    }
}
