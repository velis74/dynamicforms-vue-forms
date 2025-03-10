// form-actions.spec.ts
import { vi } from 'vitest';

import { Field } from '../field';
import { Group } from '../group';

import { ValueChangedAction, VisibilityChangedAction } from '.';

describe('Form actions', () => {
  it('corrctly executes action chain', () => {
    const klici: string[] = [];
    const valueAction1 = vi.fn((field, supr, newValue, oldValue) => {
      klici.push('valueAction1');
      return supr(field, newValue, oldValue);
    });
    const valueAction2 = vi.fn((field, supr, newValue, oldValue) => {
      klici.push('valueAction2');
      return supr(field, newValue, oldValue);
    });
    const visibilityAction = vi.fn((field, supr, newValue, oldValue) => {
      klici.push('visibilityAction');
      return supr(field, newValue, oldValue);
    });

    const field = new Field({ value: 'začetno' })
      .registerAction(new ValueChangedAction(valueAction1))
      .registerAction(new ValueChangedAction(valueAction2))
      .registerAction(new VisibilityChangedAction(visibilityAction));

    const form = new Group({
      polje1: field,
      polje2: new Field({ value: 'drugo polje' }),
    });

    // Sprožimo ValueChangedAction
    form.fields.polje1.value = 'nova vrednost';

    // Preverimo vrstni red klicev
    expect(klici).toEqual(['valueAction2', 'valueAction1']);
    expect(valueAction1).toHaveBeenCalledTimes(1);
    expect(valueAction2).toHaveBeenCalledTimes(1);
    expect(visibilityAction).not.toHaveBeenCalled();

    // Preverimo parametre klica
    expect(valueAction2).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(Function),
      'nova vrednost',
      'začetno',
    );
  });

  it('dovoli prekinjanje verige akcij', () => {
    const valueAction1 = vi.fn(async (field, supr, newValue, oldValue) => supr(field, newValue, oldValue));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const valueAction2 = vi.fn(async (field, supr, newValue, oldValue) => {
      // Ne kličemo supr, prekinemo verigo
    });

    const field = new Field({ value: 'začetno' })
      .registerAction(new ValueChangedAction(valueAction1))
      .registerAction(new ValueChangedAction(valueAction2));

    field.value = 'nova vrednost';

    expect(valueAction2).toHaveBeenCalled();
    expect(valueAction1).not.toHaveBeenCalled();
  });
});
