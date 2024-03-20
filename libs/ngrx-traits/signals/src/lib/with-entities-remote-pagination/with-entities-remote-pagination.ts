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
import {
  EntityState,
  NamedEntityState,
  setAllEntities,
} from '@ngrx/signals/entities';
import {
  EntitySignals,
  NamedEntitySignals,
} from '@ngrx/signals/entities/src/models';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { StateSignal } from '@ngrx/signals/src/state-signal';
import { pipe, tap } from 'rxjs';

import { getWithEntitiesKeys } from '../util';
import { getWithCallStatusKeys } from '../with-call-status/with-call-status.util';
import { getWithEntitiesFilterKeys } from '../with-entities-filter/with-entities-filter.util';
import type {
  EntitiesPaginationLocalMethods,
  NamedEntitiesPaginationLocalMethods,
} from '../with-entities-local-pagination/with-entities-local-pagination';
import { getWithEntitiesSortKeys } from '../with-entities-sort/with-entities-sort.util';
import { getWithEntitiesRemotePaginationKeys } from './with-entities-remote-pagination.util';

export type PaginationState = {
  currentPage: number;
  requestPage: number;
  pageSize: number;
  total: number | undefined;
  pagesToCache: number;
  cache: {
    start: number;
    end: number;
  };
};

export type EntitiesPaginationRemoteState = {
  pagination: PaginationState;
};

export type NamedEntitiesPaginationRemoteState<Collection extends string> = {
  [K in Collection as `${K}Pagination`]: PaginationState;
};

export type EntitiesPaginationRemoteComputed<Entity> = {
  entitiesCurrentPage: Signal<{
    entities: Entity[];
    pageIndex: number;
    total: number | undefined;
    pageSize: number;
    pagesCount: number | undefined;
    hasPrevious: boolean;
    hasNext: boolean;
    loading: boolean;
  }>;
  entitiesPagedRequest: Signal<{
    startIndex: number;
    size: number;
    page: number;
  }>;
};
export type NamedEntitiesPaginationRemoteComputed<
  Entity,
  Collection extends string,
> = {
  [K in Collection as `${K}PagedRequest`]: Signal<{
    startIndex: number;
    size: number;
    page: number;
  }>;
} & {
  [K in Collection as `${K}CurrentPage`]: Signal<{
    entities: Entity[];
    pageIndex: number;
    total: number | undefined;
    pageSize: number;
    pagesCount: number | undefined;
    hasPrevious: boolean;
    hasNext: boolean;
    loading: boolean;
  }>;
};
export type EntitiesPaginationRemoteMethods<Entity> =
  EntitiesPaginationLocalMethods & {
    setEntitiesLoadedResult: (entities: Entity[], total: number) => void;
  };

export type NamedEntitiesPaginationSetResultMethods<
  Entity,
  Collection extends string,
> = {
  [K in Collection as `set${Capitalize<string & K>}LoadedResult`]: (
    entities: Entity[],
    total: number,
  ) => void;
};
export type NamedEntitiesPaginationRemoteMethods<
  Entity,
  Collection extends string,
> = NamedEntitiesPaginationLocalMethods<Collection> & {
  [K in Collection as `set${Capitalize<string & K>}LoadedResult`]: (
    entities: Entity[],
    total: number,
  ) => void;
};

export function withEntitiesRemotePagination<
  Entity extends { id: string | number },
>(config: {
  pageSize?: number;
  currentPage?: number;
  pagesToCache?: number;
  entity?: Entity;
}): SignalStoreFeature<
  {
    state: EntityState<Entity>;
    signals: EntitySignals<Entity>;
    methods: {};
  },
  {
    state: EntitiesPaginationRemoteState;
    signals: EntitiesPaginationRemoteComputed<Entity>;
    methods: EntitiesPaginationRemoteMethods<Entity>;
  }
>;
export function withEntitiesRemotePagination<
  Entity extends { id: string | number },
  Collection extends string,
>(config: {
  pageSize?: number;
  currentPage?: number;
  pagesToCache?: number;
  entity?: Entity;
  collection?: Collection;
}): SignalStoreFeature<
  {
    state: NamedEntityState<Entity, any>; // if put Collection the some props get lost and can only be access ['prop'] weird bug
    signals: NamedEntitySignals<Entity, Collection>;
    methods: {};
  },
  {
    state: NamedEntitiesPaginationRemoteState<Collection>;
    signals: NamedEntitiesPaginationRemoteComputed<Entity, Collection>;
    methods: NamedEntitiesPaginationRemoteMethods<Entity, Collection>;
  }
>;
export function withEntitiesRemotePagination<
  Entity extends { id: string | number },
  Collection extends string,
>({
  pageSize = 10,
  currentPage = 0,
  pagesToCache = 3,
  ...config
}: {
  pageSize?: number;
  currentPage?: number;
  pagesToCache?: number;
  entity?: Entity;
  collection?: Collection;
} = {}): SignalStoreFeature<any, any> {
  const { loadingKey, setLoadingKey } = getWithCallStatusKeys({
    prop: config.collection,
  });
  const { entitiesKey } = getWithEntitiesKeys(config);
  const { filterKey } = getWithEntitiesFilterKeys(config);
  const { sortKey } = getWithEntitiesSortKeys(config);

  const {
    loadEntitiesPageKey,
    entitiesCurrentPageKey,
    paginationKey,
    entitiesPagedRequestKey,
    setEntitiesLoadResultKey,
  } = getWithEntitiesRemotePaginationKeys(config);

  return signalStoreFeature(
    withState({
      [paginationKey]: {
        pageSize,
        currentPage,
        requestPage: currentPage,
        pagesToCache,
        total: undefined,
        cache: {
          start: 0,
          end: 0,
        },
      },
    }),
    withComputed((state: Record<string, Signal<unknown>>) => {
      const entities = state[entitiesKey] as Signal<Entity[]>;
      const loading = state[loadingKey] as Signal<boolean>;
      const pagination = state[paginationKey] as Signal<PaginationState>;
      const entitiesCurrentPageList = computed(() => {
        const page = pagination().currentPage;
        const startIndex =
          page * pagination().pageSize - pagination().cache.start;
        let endIndex = startIndex + pagination().pageSize;
        endIndex =
          endIndex < pagination().cache.end ? endIndex : pagination().cache.end;

        return entities().slice(startIndex, endIndex);
      });

      const entitiesCurrentPage = computed(() => {
        const pagesCount =
          pagination().total && pagination().total! > 0
            ? Math.ceil(pagination().total! / pagination().pageSize)
            : undefined;
        return {
          entities: entitiesCurrentPageList(),
          pageIndex: pagination().currentPage,
          total: pagination().total,
          pageSize: pagination().pageSize,
          pagesCount,
          hasPrevious: pagination().currentPage - 1 >= 0,
          hasNext:
            pagesCount && pagination().total && pagination().total! > 0
              ? pagination().currentPage + 1 < pagesCount
              : true,
          loading:
            loading() && pagination().requestPage === pagination().currentPage,
        };
      });
      const entitiesPagedRequest = computed(() => ({
        startIndex: pagination().pageSize * pagination().requestPage,
        size: pagination().pageSize * pagination().pagesToCache,
        page: pagination().requestPage,
      }));
      return {
        [entitiesCurrentPageKey]: entitiesCurrentPage,
        [entitiesPagedRequestKey]: entitiesPagedRequest,
      };
    }),
    withMethods((state: Record<string, Signal<unknown>>) => {
      const pagination = state[paginationKey] as Signal<PaginationState>;
      const setLoading = state[setLoadingKey] as () => void;
      const entitiesList = state[entitiesKey] as Signal<Entity[]>;
      return {
        [setEntitiesLoadResultKey]: (entities: Entity[], total: number) => {
          // TODO extract this function and test all egg cases, like preloading next pages and jumping page
          const isPreloadNextPagesReady =
            pagination().currentPage + 1 === pagination().requestPage;

          const newStart = pagination().currentPage * pagination().pageSize;
          const newEntities = isPreloadNextPagesReady
            ? [...entitiesList(), ...entities]
            : entities;
          patchState(
            state as StateSignal<object>,
            config.collection
              ? setAllEntities(newEntities, {
                  collection: config.collection,
                })
              : setAllEntities(newEntities),
            {
              [paginationKey]: {
                ...pagination(),
                total,
                cache: {
                  ...pagination().cache,
                  start: isPreloadNextPagesReady
                    ? pagination().cache.start
                    : newStart,
                  end: isPreloadNextPagesReady
                    ? pagination().cache.end + entities.length
                    : newStart + entities.length,
                },
              },
            },
          );
        },
        [loadEntitiesPageKey]: rxMethod<{
          pageIndex: number;
          forceLoad?: boolean;
        }>(
          pipe(
            tap(({ pageIndex, forceLoad }) => {
              patchState(state as StateSignal<object>, {
                [paginationKey]: {
                  ...pagination(),
                  currentPage: pageIndex,
                  requestPage: pageIndex,
                },
              });
              if (
                isEntitiesPageInCache(pageIndex, pagination()) &&
                !forceLoad
              ) {
                if (!isEntitiesPageInCache(pageIndex + 1, pagination())) {
                  // preload next page
                  patchState(state as StateSignal<object>, {
                    [paginationKey]: {
                      ...pagination(),
                      currentPage: pageIndex,
                      requestPage: pageIndex + 1,
                    },
                  });
                  setLoading();
                }
                return;
              }
              setLoading();
            }),
          ),
        ),
      };
    }),
    withHooks({
      onInit: (input) => {
        // we need reset the currentPage to 0 when the filter or sorting changes
        if (filterKey in input || sortKey in input) {
          const filter = input[filterKey] as Signal<any>;
          const sort = input[sortKey] as Signal<any>;
          const entitiesCurrentPage = input[
            entitiesCurrentPageKey
          ] as Signal<any>;
          const loadEntitiesPage = input[
            loadEntitiesPageKey
          ] as EntitiesPaginationRemoteMethods<Entity>['loadEntitiesPage'];
          effect(
            () => {
              // we need to call filter or sort signals if available so
              // this effect gets call when they change
              filter?.();
              sort?.();
              if (entitiesCurrentPage().pageIndex > 0) {
                console.log('local filter or sort changed, reseting page to 0');
                loadEntitiesPage({ pageIndex: 0 });
              }
            },
            { allowSignalWrites: true },
          );
        }
      },
    }),
  );
}

function isEntitiesPageInCache(
  page: number,
  pagination: EntitiesPaginationRemoteState['pagination'],
) {
  const startIndex = page * pagination.pageSize;
  let endIndex = startIndex + pagination.pageSize - 1;
  endIndex =
    pagination.total && endIndex > pagination.total
      ? pagination.total - 1
      : endIndex;
  return (
    startIndex >= pagination.cache.start && endIndex <= pagination.cache.end
  );
}
