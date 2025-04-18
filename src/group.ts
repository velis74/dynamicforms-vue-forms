import { isEmpty, isEqual } from 'lodash-es';

import { ValueChangedAction } from './actions';
import { Field } from './field';
import { FieldBase } from './field-base';
import { IField, IFieldConstructorParams } from './field.interface';

export type GenericFieldsInterface = Record<string, IField>;

export class Group<T extends GenericFieldsInterface = GenericFieldsInterface> extends FieldBase {
  private readonly _fields: T;

  private _value: Record<string, any> | null = null;

  private suppressNotifyValueChanged: boolean = false;

  constructor(fields: T, params?: Partial<IFieldConstructorParams>) {
    super();

    if (!Group.isValidFields(fields)) throw new Error('Invalid fields object provided');
    this._fields = {} as T;
    Object.entries(fields).forEach(([name, field]) => {
      Object.defineProperty(field, 'parent', { get: () => this, configurable: false, enumerable: false });
      Object.defineProperty(field, 'fieldName', { get: () => name, configurable: false, enumerable: false });
      Object.defineProperty(
        this._fields,
        name,
        { get() { return field; }, configurable: false, enumerable: true },
      );
    });

    if (params) {
      const { value: paramValue, validators, actions, ...otherParams } = params;
      [...(validators || []), ...(actions || [])].forEach((a) => this.registerAction(a));
      Object.assign(this, otherParams);
      this.value = paramValue ?? this.originalValue;
    }

    if (this.originalValue === undefined) this.originalValue = this.value;

    // if (Object.keys(this._fields).length) console.log('group created', this, Error().stack);
    this.actions.triggerEager(this, this.value, this.originalValue);
  }

  private static isValidFields(flds: unknown): flds is Record<string, FieldBase> {
    function isFieldAll(field: unknown): field is FieldBase {
      return field instanceof FieldBase;
    }

    return typeof flds === 'object' &&
      flds !== null &&
      Object.entries(flds).every(([, field]) => isFieldAll(field));
  }

  static createFromFormData(data: Record<string, any> | null): Group {
    if (data instanceof FieldBase) {
      throw new Error('data is already a Form structure, should be a simple object');
    }
    return new Group(
      data == null ?
        { } :
        Object.fromEntries(
          Object.entries(data).map(([key, value]) => [key, Field.create({ value })]),
        ),
    );
  }

  field<K extends keyof T>(fieldName: K): T[K] | null {
    return this._fields[fieldName] ?? null;
  }

  get fields(): T {
    return this._fields;
  }

  get value(): Record<string, any> | null {
    const value: Record<string, any> = {};
    Object.entries(this._fields).forEach(([name, field]) => {
      const fieldValue = field.value;
      if (field.enabled) {
        // readOnly fields do not serialize
        value[name] = fieldValue;
      } else if (field instanceof Group && !isEmpty(fieldValue)) {
        // readOnly group only serializes if it is non-empty (some of its fields are not readOnly)
        value[name] = fieldValue;
      }
    });
    return isEmpty(value) ? null : value;
  }

  set value(newValue: Record<string, any> | null) {
    this.suppressNotifyValueChanged = true;
    try {
      Object.entries(this._fields).forEach(([name, field]) => {
        if (newValue == null || name in newValue) {
          field.value = newValue == null ? null : newValue[name];
        }
      });
    } finally {
      this.suppressNotifyValueChanged = false;
    }
    this.notifyValueChanged();
  }

  async setValue(newValue: Record<string, any> | null) {
    this.suppressNotifyValueChanged = true;

    async function fieldSetter(name: string, field: IField) {
      if (newValue == null || name in newValue) {
        await field.setValue(newValue == null ? null : newValue[name]);
      }
    }

    try {
      for (const [name, entry] of Object.entries(this._fields)) {
        await fieldSetter(name, entry); // eslint-disable-line no-await-in-loop
      }
    } finally {
      this.suppressNotifyValueChanged = false;
    }
    await this.notifyValueChanged();
  }

  get fullValue(): Record<string, any> {
    const value: Record<string, any> = {};
    Object.entries(this._fields).forEach(([name, field]) => { value[name] = field.fullValue; });
    return value;
  }

  async notifyValueChanged() {
    if (this.suppressNotifyValueChanged) return;
    const newValue = this.value;
    if (!isEqual(newValue, this._value)) {
      const oldValue = this._value;
      this._value = newValue;
      await this.actions.trigger(ValueChangedAction, this, newValue, oldValue);
      if (this.parent) await this.parent.notifyValueChanged();
    }
  }

  clone(overrides?: Partial<IField>): Group<T> {
    const newFields = {} as T;
    Object.entries(this._fields).forEach(([name, field]) => {
      newFields[name as keyof T] = field.clone() as any;
    });

    return new Group(newFields, {
      value: overrides?.value ?? this.value,
      ...(overrides && 'originalValue' in overrides ? { originalValue: overrides.originalValue } : { }),
      errors: [...(overrides?.errors ?? [])],
      enabled: overrides?.enabled ?? this.enabled,
      visibility: overrides?.visibility ?? this.visibility,
    });
  }
}

export type NullableGroup = Group | null;
