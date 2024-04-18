import { computed, effect, Signal } from '@angular/core';
import {
  patchState,
  signalStoreFeature,
  SignalStoreFeature,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { EntityState, NamedEntityState } from '@ngrx/signals/entities';
import {
  EntityId,
  EntityMap,
  EntitySignals,
  NamedEntitySignals,
} from '@ngrx/signals/entities/src/models';
import type { StateSignal } from '@ngrx/signals/src/state-signal';

import { capitalize, combineFunctions, getWithEntitiesKeys } from '../util';
import {
  EntitiesMultiSelectionComputed,
  EntitiesMultiSelectionMethods,
  EntitiesMultiSelectionState,
  NamedEntitiesMultiSelectionComputed,
  NamedEntitiesMultiSelectionMethods,
  NamedEntitiesMultiSelectionState,
} from './with-entities-multi-selection.model';
import { getEntitiesMultiSelectionKeys } from './with-entities-multi-selection.util';

/**
 * Generates state, signals and methods for multi selection of entities.
 * Warning: isAll[Collection]Selected and toggleSelectAll[Collection] wont work
 * correctly in using remote pagination, because they cant select all the data
 * @param config
 * @param config.entity - the entity type
 * @param config.collection - the collection name
 *
 * @example
 * const entity = type<Product>();
 * const collection = 'products';
 * export const store = signalStore(
 *   { providedIn: 'root' },
 *   withEntities({ entity, collection }),
 *   withEntitiesMultiSelection({ entity, collection }),
 *   );
 *
 * // generates the following signals
 * store.productsIdsSelectedMap // Record<string | number, boolean>;
 * // generates the following computed signals
 * store.productsEntitiesSelected // Entity[];
 * store.isAllProductsSelected // 'all' | 'none' | 'some';
 * // generates the following methods
 * store.selectProducts // (config: { id: string | number } | { ids: (string | number)[] }) => void;
 * store.deselectProducts // (config: { id: string | number } | { ids: (string | number)[] }) => void;
 * store.toggleSelectProducts // (config: { id: string | number } | { ids: (string | number)[] }) => void;
 * store.toggleSelectAllProducts // () => void;
 */
export function withEntitiesMultiSelection<
  Entity extends { id: string | number },
>(config: {
  entity?: Entity;
}): SignalStoreFeature<
  {
    state: EntityState<Entity>;
    signals: EntitySignals<Entity>;
    methods: {};
  },
  {
    state: EntitiesMultiSelectionState;
    signals: EntitiesMultiSelectionComputed<Entity>;
    methods: EntitiesMultiSelectionMethods;
  }
>;

/**
 * Generates state, signals and methods for multi selection of entities.
 * Warning: isAll[Collection]Selected and toggleSelectAll[Collection] wont work
 * correctly in using remote pagination, because they cant select all the data
 * @param config
 * @param config.entity - the entity type
 * @param config.collection - the collection name
 *
 * @example
 * const entity = type<Product>();
 * const collection = 'products';
 * export const store = signalStore(
 *   { providedIn: 'root' },
 *   withEntities({ entity, collection }),
 *   withEntitiesMultiSelection({ entity, collection }),
 *   );
 *
 * // generates the following signals
 * store.productsIdsSelectedMap // Record<string | number, boolean>;
 * // generates the following computed signals
 * store.productsEntitiesSelected // Entity[];
 * store.isAllProductsSelected // 'all' | 'none' | 'some';
 * // generates the following methods
 * store.selectProducts // (config: { id: string | number } | { ids: (string | number)[] }) => void;
 * store.deselectProducts // (config: { id: string | number } | { ids: (string | number)[] }) => void;
 * store.toggleSelectProducts // (config: { id: string | number } | { ids: (string | number)[] }) => void;
 * store.toggleSelectAllProducts // () => void;
 */
export function withEntitiesMultiSelection<
  Entity extends { id: string | number },
  Collection extends string,
>(config: {
  entity?: Entity;
  collection?: Collection;
}): SignalStoreFeature<
  // TODO: the problem seems be with the state pro, when set to empty
  //  it works but is it has a namedstate it doesnt
  {
    state: NamedEntityState<Entity, any>;
    signals: NamedEntitySignals<Entity, Collection>;
    methods: {};
  },
  {
    state: NamedEntitiesMultiSelectionState<Collection>;
    signals: NamedEntitiesMultiSelectionComputed<Entity, Collection>;
    methods: NamedEntitiesMultiSelectionMethods<Collection>;
  }
>;

export function withEntitiesMultiSelection<
  Entity extends { id: string | number },
  Collection extends string,
>(config: {
  entity?: Entity;
  collection?: Collection;
}): SignalStoreFeature<
  // TODO: the problem seems be with the state pro, when set to empty
  //  it works but is it has a namedstate it doesnt
  {
    state: NamedEntityState<Entity, any>;
    signals: NamedEntitySignals<Entity, Collection>;
    methods: {};
  },
  {
    state: NamedEntitiesMultiSelectionState<Collection>;
    signals: NamedEntitiesMultiSelectionComputed<Entity, Collection>;
    methods: NamedEntitiesMultiSelectionMethods<Collection>;
  }
>;
export function withEntitiesMultiSelection<
  Entity extends { id: string | number },
  Collection extends string,
>(config: {
  entity?: Entity;
  collection?: Collection;
}): SignalStoreFeature<any, any> {
  const { entityMapKey, idsKey, clearEntitiesCacheKey } =
    getWithEntitiesKeys(config);
  const {
    selectedIdsMapKey,
    selectedEntitiesKey,
    selectedEntitiesIdsKey,
    deselectEntitiesKey,
    toggleSelectEntitiesKey,
    clearEntitiesSelectionKey,
    selectEntitiesKey,
    toggleSelectAllEntitiesKey,
    isAllEntitiesSelectedKey,
  } = getEntitiesMultiSelectionKeys(config);
  return signalStoreFeature(
    withState({ [selectedIdsMapKey]: {} }),
    withComputed((state: Record<string, Signal<unknown>>) => {
      const entityMap = state[entityMapKey] as Signal<EntityMap<Entity>>;
      const idsArray = state[idsKey] as Signal<Entity[]>;
      const selectedIdsMap = state[selectedIdsMapKey] as Signal<
        Record<string | number, boolean>
      >;
      const selectedIdsArray = computed(() =>
        Object.entries(selectedIdsMap()).reduce(
          (aux, [id, selected]) => {
            if (selected && entityMap()[id]) {
              aux.push(id);
            }
            return aux;
          },
          [] as (string | number)[],
        ),
      );
      return {
        [selectedEntitiesIdsKey]: selectedIdsArray,
        [selectedEntitiesKey]: computed(() => {
          return selectedIdsArray().map((id) => entityMap()[id]);
        }),
        [isAllEntitiesSelectedKey]: computed(() => {
          const ids = selectedIdsArray();

          if (ids.length === 0) {
            return 'none';
          }
          if (ids.length === idsArray().length) {
            return 'all';
          }
          return 'some';
        }),
      };
    }),
    withMethods((state: Record<string, Signal<unknown>>) => {
      const selectedIdsMap = state[selectedIdsMapKey] as Signal<
        Record<string | number, boolean>
      >;
      const isAllEntitiesSelected = state[isAllEntitiesSelectedKey] as Signal<
        'all' | 'none' | 'some'
      >;

      const idsArray = state[idsKey] as Signal<EntityId[]>;

      const clearEntitiesSelection = () => {
        patchState(state as StateSignal<object>, {
          [selectedIdsMapKey]: {},
        });
      };
      return {
        [clearEntitiesCacheKey]: combineFunctions(
          state[clearEntitiesCacheKey],
          () => {
            clearEntitiesSelection();
          },
        ),
        [selectEntitiesKey]: (
          options: { id: string | number } | { ids: (string | number)[] },
        ) => {
          const ids = 'id' in options ? [options.id] : options.ids;
          const idsMap = ids.reduce(
            (acc, id) => {
              acc[id] = true;
              return acc;
            },
            {} as Record<string | number, boolean>,
          );

          patchState(state as StateSignal<object>, {
            [selectedIdsMapKey]: { ...selectedIdsMap(), ...idsMap },
          });
        },
        [deselectEntitiesKey]: (
          options: { id: string | number } | { ids: (string | number)[] },
        ) => {
          const ids = 'id' in options ? [options.id] : options.ids;
          const idsMap = ids.reduce(
            (acc, id) => {
              acc[id] = false;
              return acc;
            },
            {} as Record<string | number, boolean>,
          );
          patchState(state as StateSignal<object>, {
            [selectedIdsMapKey]: { ...selectedIdsMap(), ...idsMap },
          });
        },
        [toggleSelectEntitiesKey]: (
          options: { id: string | number } | { ids: (string | number)[] },
        ) => {
          const ids = 'id' in options ? [options.id] : options.ids;
          const oldIdsMap = selectedIdsMap();
          const idsMap = ids.reduce(
            (acc, id) => {
              acc[id] = !oldIdsMap[id];
              return acc;
            },
            {} as Record<string | number, boolean>,
          );
          patchState(state as StateSignal<object>, {
            [selectedIdsMapKey]: { ...oldIdsMap, ...idsMap },
          });
        },
        [clearEntitiesSelectionKey]: clearEntitiesSelection,
        [toggleSelectAllEntitiesKey]: () => {
          const allSelected = isAllEntitiesSelected();
          if (allSelected === 'all') {
            patchState(state as StateSignal<object>, {
              [selectedIdsMapKey]: {},
            });
          } else {
            const idsMap = idsArray().reduce(
              (acc, id) => {
                acc[id] = true;
                return acc;
              },
              {} as Record<string | number, boolean>,
            );
            patchState(state as StateSignal<object>, {
              [selectedIdsMapKey]: idsMap,
            });
          }
        },
      };
    }),
  );
}