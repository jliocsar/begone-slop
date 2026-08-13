import { Plugin } from 'effect-oxlint'
import expectPadding from './rules/expect-padding.ts'
import noBannedTypeAssertions from './rules/no-banned-type-assertions.ts'
import noCascadingLayerProvide from './rules/no-cascading-layer-provide.ts'
import noChainedTypeAssertions from './rules/no-chained-type-assertions.ts'
import noComments from './rules/no-comments.ts'
import noConditionalEmptyObjectSpread from './rules/no-conditional-empty-object-spread.ts'
import noDisableValidation from './rules/no-disable-validation.ts'
import noEffectAsVoid from './rules/no-effect-asvoid.ts'
import noInOperator from './rules/no-in-operator.ts'
import noKnownValueWidening from './rules/no-known-value-widening.ts'
import noModuleMocking from './rules/no-module-mocking.ts'
import noNestedEffectArrayMethods from './rules/no-nested-effect-array-methods.ts'
import noNestedLayerProvide from './rules/no-nested-layer-provide.ts'
import noObjectParameters from './rules/no-object-parameters.ts'
import noOptionalFunctionParameters from './rules/no-optional-function-parameters.ts'
import noReexportOnlyModules from './rules/no-reexport-only-modules.ts'
import noReflectApply from './rules/no-reflect-apply.ts'
import noReflectGet from './rules/no-reflect-get.ts'
import noRuntimeTypeof from './rules/no-runtime-typeof.ts'
import noServiceOption from './rules/no-service-option.ts'
import noShadowedErrorField from './rules/no-shadowed-error-field.ts'
import noShadowedStandardArrayStatic from './rules/no-shadowed-standard-array-static.ts'
import noSilentErrorSwallow from './rules/no-silent-error-swallow.ts'
import noSqlTypeParameter from './rules/no-sql-type-parameter.ts'
import noSwitch from './rules/no-switch.ts'
import noTagAccess from './rules/no-tag-access.ts'
import noTryCatch from './rules/no-try-catch.ts'
import noUnknownParameters from './rules/no-unknown-parameters.ts'
import noUnknownReturns from './rules/no-unknown-returns.ts'
import noUnknownTypeAliases from './rules/no-unknown-type-aliases.ts'
import noUnsafeDictionaryType from './rules/no-unsafe-dictionary-type.ts'
import noWidenThenAssert from './rules/no-widen-then-assert.ts'
import paddingLineBetweenStatements from './rules/padding-line-between-statements.ts'
import pipeMaxArguments from './rules/pipe-max-arguments.ts'
import preferEffectMatch from './rules/prefer-effect-match.ts'
import preferOptionFromNullable from './rules/prefer-option-from-nullable.ts'
import requireSafetyCommentForTypeAssertion from './rules/require-safety-comment-for-type-assertion.ts'
import statementOrder from './rules/statement-order.ts'

export default Plugin.define({
  name: 'begone-slop',
  rules: {
    'statement-order': statementOrder,
    'expect-padding': expectPadding,
    'no-tag-access': noTagAccess,
    'no-shadowed-error-field': noShadowedErrorField,
    'padding-line-between-statements': paddingLineBetweenStatements,
    'no-switch': noSwitch,
    'no-try-catch': noTryCatch,
    'no-in-operator': noInOperator,
    'no-service-option': noServiceOption,
    'no-effect-asvoid': noEffectAsVoid,
    'no-disable-validation': noDisableValidation,
    'no-banned-type-assertions': noBannedTypeAssertions,
    'no-optional-function-parameters': noOptionalFunctionParameters,
    'no-sql-type-parameter': noSqlTypeParameter,
    'pipe-max-arguments': pipeMaxArguments,
    'no-reflect-get': noReflectGet,
    'no-reflect-apply': noReflectApply,
    'no-conditional-empty-object-spread': noConditionalEmptyObjectSpread,
    'no-chained-type-assertions': noChainedTypeAssertions,
    'no-nested-effect-array-methods': noNestedEffectArrayMethods,
    'no-shadowed-standard-array-static': noShadowedStandardArrayStatic,
    'no-silent-error-swallow': noSilentErrorSwallow,
    'no-unknown-parameters': noUnknownParameters,
    'no-unknown-returns': noUnknownReturns,
    'no-unknown-type-aliases': noUnknownTypeAliases,
    'prefer-effect-match': preferEffectMatch,
    'prefer-option-from-nullable': preferOptionFromNullable,
    'require-safety-comment-for-type-assertion': requireSafetyCommentForTypeAssertion,
    'no-cascading-layer-provide': noCascadingLayerProvide,
    'no-comments': noComments,
    'no-nested-layer-provide': noNestedLayerProvide,
    'no-reexport-only-modules': noReexportOnlyModules,
    'no-known-value-widening': noKnownValueWidening,
    'no-module-mocking': noModuleMocking,
    'no-object-parameters': noObjectParameters,
    'no-runtime-typeof': noRuntimeTypeof,
    'no-unsafe-dictionary-type': noUnsafeDictionaryType,
    'no-widen-then-assert': noWidenThenAssert,
  },
})
