import {
  computed,
  effect,
  Injector,
  isSignal,
  signal,
  Signal,
  WritableSignal,
} from '@angular/core';
import {
  computeErrors,
  computeErrorsArray,
  computeState,
  computeValidateState,
  computeValidators,
  hasValidator,
  InvalidDetails,
  ValidationErrors,
  ValidationState,
  Validator,
} from './validation';

/**
 * `DirtyState` can either be `PRISTINE` or `DIRTY`.
 * If the state ist `DIRTY` the `dirty` signal returns `true`.
 */
export type DirtyState = 'PRISTINE' | 'DIRTY';
/**
 * `TouchedState` can either be `TOUCHED` or `UNTOUCHED`.
 * If the state ist `TOUCHED` the `touched` signal returns `true`.
 */
export type TouchedState = 'TOUCHED' | 'UNTOUCHED';

export type FormField<Value = unknown> = {
  __type: 'FormField';
  /**
   * A writable signal that can be used to get or change the current value of the `FormField`.
   */
  value: WritableSignal<Value>;
  /**
   * A signal that returns the validation errors of the `FormField`.
   */
  errors: Signal<ValidationErrors>;
  errorsArray: Signal<InvalidDetails[]>;
  /**
   * A signal that returns the current validation state of the `FormField`.
   *
   * @see {@link ValidationState}
   */
  state: Signal<ValidationState>;
  /**
   * A signal that returns `true` if the `state` is `VALID`.
   *
   * @see {@link ValidationState}
   */
  valid: Signal<boolean>;
  dirtyState: Signal<DirtyState>;
  dirty: Signal<boolean>;
  touchedState: Signal<TouchedState>;
  touched: Signal<boolean>;
  hidden: Signal<boolean>;
  disabled: Signal<boolean>;
  readOnly: Signal<boolean>;
  /**
   * Mark the `FormField` as `TOUCHED`.
   *
   * A `TOUCHED` is emitted by the `touchedStateSignal` signal and the `touched` signal emits `true`.
   *
   * @see {@link TouchedState}
   *
   * @returns void
   */
  markAsTouched: () => void;
  markAsDirty: () => void;
  reset: () => void;
  hasError: (errorKey: string) => boolean;
  hasValidator: (validator: Validator) => boolean;
  errorMessage: (errorKey: string) => string | undefined,
  registerOnReset: (fn: (value: Value) => void) => void;
};

export type FormFieldOptions = {
  validators?: Validator<any>[];
  hidden?: () => boolean;
  disabled?: () => boolean;
  readOnly?: () => boolean;
};
export type FormFieldOptionsCreator<T> = (value: Signal<T>) => FormFieldOptions;

/**
 * Creates a new `FormField`.
 *
 * @param value
 * @param options
 * @param injector
 *
 * @returns FormField
 */
export function createFormField<Value>(
  value: Value | WritableSignal<Value>,
  options?: FormFieldOptions | FormFieldOptionsCreator<Value>,
  injector?: Injector
): FormField<Value> {
  const valueSignal =
    // needed until types for writable signal are fixed
    (
      typeof value === 'function' && isSignal(value) ? value : signal(value)
    ) as WritableSignal<Value>;
  const finalOptions =
    options && typeof options === 'function' ? options(valueSignal) : options;

  const validatorsSignal = computeValidators(
    valueSignal,
    finalOptions?.validators,
    injector
  );
  const validateStateSignal = computeValidateState(validatorsSignal);

  const errorsSignal = computeErrors(validateStateSignal);
  const errorsArraySignal = computeErrorsArray(validateStateSignal);

  const stateSignal = computeState(validateStateSignal);
  const validSignal = computed(() => stateSignal() === 'VALID');

  const touchedStateSignal = signal<TouchedState>('UNTOUCHED');
  const touchedSignal = computed(() => touchedStateSignal() === 'TOUCHED');
  const dirtyStateSignal = signal<DirtyState>('PRISTINE');
  const dirtySignal = computed(() => dirtyStateSignal() === 'DIRTY');
  const hiddenSignal = signal(false);
  const disabledSignal = signal(false);
  const readOnlySignal = signal(false);

  let previousValue: unknown|undefined = undefined;
  effect(
    () => {
      const newValue = valueSignal();
      if (previousValue !== undefined && newValue !== previousValue) {
        dirtyStateSignal.set('DIRTY');
      }
      previousValue = newValue;
    },
    {
      allowSignalWrites: true,
      injector: injector,
    }
  );

  if (finalOptions?.hidden) {
    effect(
      () => {
        hiddenSignal.set(finalOptions!.hidden!());
      },
      {
        allowSignalWrites: true,
        injector: injector,
      }
    );
  }

  if (finalOptions?.disabled) {
    effect(
      () => {
        disabledSignal.set(finalOptions!.disabled!());
      },
      {
        allowSignalWrites: true,
        injector: injector,
      }
    );
  }

  if (finalOptions?.readOnly) {
    effect(
      () => {
        readOnlySignal.set(finalOptions!.readOnly!());
      },
      {
        allowSignalWrites: true,
        injector: injector,
      }
    );
  }

  const defaultValue =
    typeof value === 'function' && isSignal(value) ? value() : value;
  let onReset = (_value: Value) => {};

  return {
    __type: 'FormField',
    value: valueSignal,
    errors: errorsSignal,
    errorsArray: errorsArraySignal,
    state: stateSignal,
    valid: validSignal,
    touchedState: touchedStateSignal,
    touched: touchedSignal,
    dirtyState: dirtyStateSignal,
    dirty: dirtySignal,
    hidden: hiddenSignal,
    disabled: disabledSignal,
    readOnly: readOnlySignal,
    markAsTouched: () => touchedStateSignal.set('TOUCHED'),
    markAsDirty: () => dirtyStateSignal.set('DIRTY'),
    hasError: (errorKey: string) => !!errorsSignal()[errorKey],
    hasValidator: (validator: Validator) => {
      if (finalOptions !== undefined) {
        return hasValidator(finalOptions.validators, validator);
      } else {
        return false;
      }
    },
    errorMessage: (errorKey: string) => errorsArraySignal().find(e => e.key === errorKey)?.message,
    registerOnReset: (fn: (value: Value) => void) => (onReset = fn),
    reset: () => {
      valueSignal.set(defaultValue);
      touchedStateSignal.set('UNTOUCHED');
      dirtyStateSignal.set('PRISTINE');
      onReset(defaultValue);
    },
  };
}
