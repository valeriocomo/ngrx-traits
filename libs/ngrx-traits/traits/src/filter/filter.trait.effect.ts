import { Injectable } from '@angular/core';
import { TraitEffect } from 'ngrx-traits';
import { asyncScheduler, EMPTY, of, timer } from 'rxjs';
import {
  concatMap,
  debounce,
  distinctUntilChanged,
  first,
  map,
} from 'rxjs/operators';
import { createEffect, ofType } from '@ngrx/effects';
import { FilterKeyedConfig, FilterSelectors } from './filter.model';
import {
  LoadEntitiesActions,
  LoadEntitiesSelectors,
} from '../load-entities/load-entities.model';
import { Type } from 'ngrx-traits';
import { ƟFilterActions } from './filter.model.internal';
import { PaginationActions } from '../pagination';

export function createFilterTraitEffects<Entity, F>(
  allActions: ƟFilterActions<F> &
    LoadEntitiesActions<Entity> &
    PaginationActions,
  allSelectors: FilterSelectors<Entity, F> & LoadEntitiesSelectors<Entity>,
  allConfigs: FilterKeyedConfig<Entity, F>
): Type<TraitEffect>[] {
  const traitConfig = allConfigs.filter;
  @Injectable()
  class FilterEffect extends TraitEffect {
    storeFilter$ = createEffect(
      () =>
        ({
          debounce: debounceTime = traitConfig!.defaultDebounceTime,
          scheduler = asyncScheduler,
        } = {}) =>
          this.actions$.pipe(
            ofType(allActions.filter),
            debounce((value) =>
              value?.forceLoad ? EMPTY : timer(debounceTime, scheduler)
            ),
            concatMap((payload) =>
              payload.patch
                ? this.store.select(allSelectors.selectFilter).pipe(
                    first(),
                    map((storedFilters) => ({
                      ...payload,
                      filters: { ...storedFilters, ...payload?.filters },
                    }))
                  )
                : of(payload)
            ),
            distinctUntilChanged(
              (previous, current) =>
                !current?.forceLoad &&
                JSON.stringify(previous?.filters) ===
                  JSON.stringify(current?.filters)
            ),
            map((action) =>
              allActions.storeFilter({
                filters: action?.filters,
                patch: action?.patch,
              })
            )
          )
    );

    fetch$ =
      !traitConfig?.filterFn &&
      createEffect(() => {
        return this.actions$.pipe(
          ofType(allActions['storeFilter']),
          concatMap(() =>
            allActions?.loadFirstPage
              ? [allActions.clearPagesCache(), allActions.loadFirstPage()]
              : [allActions.fetch()]
          )
        );
      });
  }

  return [FilterEffect];
}