import { Injectable } from '@angular/core';
import { TraitEffect } from 'ngrx-traits';
import { createEffect, ofType } from '@ngrx/effects';
import { concatMap } from 'rxjs/operators';
import { Type } from 'ngrx-traits';
import {
  LoadEntitiesActions,
  LoadEntitiesKeyedConfig,
} from '../load-entities/load-entities.model';
import { SortActions, SortKeyedConfig } from './sort.model';
import { PaginationActions } from '../pagination/pagination.model';

export function createSortTraitEffect<Entity>(
  allActions: LoadEntitiesActions<Entity> &
    SortActions<Entity> &
    PaginationActions,
  allConfigs: LoadEntitiesKeyedConfig<Entity> & SortKeyedConfig<Entity>
): Type<TraitEffect>[] {
  const { remote } = allConfigs.sort!;

  @Injectable()
  class SortEffect extends TraitEffect {
    remoteSort$ = createEffect(() => {
      return this.actions$.pipe(
        ofType(allActions.sort, allActions.resetSort),
        concatMap(() =>
          allActions.loadFirstPage
            ? [allActions.clearPagesCache(), allActions.loadFirstPage()]
            : [allActions.fetch()]
        )
      );
    });
  }
  return remote ? [SortEffect] : [];
}