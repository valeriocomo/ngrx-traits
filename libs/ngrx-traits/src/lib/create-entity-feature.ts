import {
  Config,
  ExtractActionsType,
  ExtractMutatorsType,
  ExtractSelectorsType,
  ExtractStateType,
  EntityFeatureFactory,
  FeatureSelectors,
  KeyedConfig,
  TraitActions,
  TraitActionsFactoryConfig,
  TraitFactory,
  TraitSelectors,
  TraitStateMutators,
  UnionToIntersection,
  TraitActionsFactory,
  TraitSelectorsFactory,
  TraitInitialStateFactory,
  TraitStateMutatorsFactory,
  TraitReducerFactory,
  TraitEffectsFactory,
} from './model';
import {
  Action,
  ActionType,
  combineReducers,
  createFeatureSelector,
  createReducer,
  createSelector,
  MemoizedSelector,
} from '@ngrx/store';
import { TraitEffect } from './trait-effect';
import { Type } from './local-store';
import { capitalize } from './util';

export function createTraitFactory<
  State = {},
  A extends TraitActions = {},
  S extends TraitSelectors<State> = {},
  M extends TraitStateMutators<State> = {},
  KEY extends string = string,
  C = unknown,
  KC = KeyedConfig<KEY, C>
>(f: {
  key: KEY;
  config?: C;
  depends?: string[];
  actions?: TraitActionsFactory<A, KC>;
  selectors?: TraitSelectorsFactory<State, S, KC>;
  initialState?: TraitInitialStateFactory<State, KC>;
  mutators?: TraitStateMutatorsFactory<State, M, KC>;
  reducer?: TraitReducerFactory<State, A, S, M, KC>;
  effects?: TraitEffectsFactory<State, A, S, KC>;
}): TraitFactory<State, A, S, M, KEY, C, KC> {
  return f as TraitFactory<State, A, S, M, KEY, C, KC>;
}

export function createEntityFeatureFactory<
  F extends readonly TraitFactory[],
  EntityName extends string,
  EntitiesName extends string = `${EntityName}s`
>(
  {
    entityName,
    entitiesName,
  }: { entityName: EntityName; entitiesName?: EntitiesName },
  ...traits: F
): EntityFeatureFactory<
  EntityName,
  EntitiesName,
  ExtractStateType<F>,
  ExtractActionsType<F>,
  ExtractSelectorsType<F>
> {
  return ((config: Config<any, any>) => {
    const singular = capitalize(entityName);
    const plural = entitiesName
      ? capitalize(entitiesName)
      : capitalize(entityName + 's');

    const sortedTraits = sortTraits([...traits]);

    const allConfigs = buildAllConfigs(sortedTraits);

    const allActions = buildAllActions(
      sortedTraits,
      config.actionsGroupKey,
      singular,
      plural,
      allConfigs
    );

    const allSelectors = buildAllSelectors(sortedTraits, allConfigs);

    const allMutators = buildAllMutators(
      sortedTraits,
      allSelectors,
      allConfigs
    );

    const initialState = buildInitialState(sortedTraits, allConfigs);

    const reducer = buildReducer(
      sortedTraits,
      initialState,
      allActions,
      allSelectors,
      allMutators,
      allConfigs
    );

    const featureSelector =
      typeof config.featureSelector === 'string'
        ? createFeatureSelector<ExtractStateType<F>>(config.featureSelector)
        : config.featureSelector;

    const allFeatureSelectors =
      allSelectors && getSelectorsForFeature(featureSelector, allSelectors);

    const allEffects = buildAllEffects(
      sortedTraits,
      allActions,
      allFeatureSelectors,
      allConfigs
    );

    return {
      actions: entityName
        ? renameProps(allActions, singular, plural)
        : allActions,
      selectors: entityName
        ? renameProps(allFeatureSelectors, singular, plural)
        : allSelectors,
      initialState,
      reducer: reducer ?? createReducer(initialState),
      effects: allEffects,
    };
  }) as EntityFeatureFactory<
    EntityName,
    EntitiesName,
    ExtractStateType<F>,
    ExtractActionsType<F>,
    ExtractSelectorsType<F>
  >;
}

function renameProps(target: any, entityName: string, entitiesName: string) {
  const result = {} as any;
  for (const [key, value] of Object.entries(target)) {
    const newKey = key
      .replace('Entities', entitiesName)
      .replace('Entity', entityName);
    result[newKey] = value;
  }
  return result;
}
function sortTraits(
  traits: TraitFactory<any, any, any, any>[]
): TraitFactory<any, any, any, any>[] {
  const sortedTraits: TraitFactory<any, any, any, any>[] = [];
  for (let i = 0; i < traits.length; i++) {
    const trait = traits[i];
    if (!trait.depends?.length) {
      sortedTraits.push(trait);
      continue;
    }
    if (trait.depends.length > 1)
      for (const d of trait.depends) {
        const isTraitPresent = traits.some((tr) => tr.key === d);
        if (isTraitPresent) {
          trait.depends = [d];
          break;
        }
      }
    if (trait.depends.length > 1)
      throw Error('could not find dependencies ' + trait.depends.join(' '));
    const isDependencyAlreadyAdded = sortedTraits.some(
      (tr) => tr.key === trait?.depends?.[0]
    );

    if (isDependencyAlreadyAdded) sortedTraits.push(trait);
    else {
      // move trait to the end
      delete traits[i];
      traits.push(trait);
    }
  }
  return sortedTraits;
}

function buildAllConfigs(sortedTraits: TraitFactory<any, any, any, any>[]) {
  return sortedTraits.reduce((acc: KeyedConfig<string, any>, factory) => {
    acc[factory.key] = factory.config;
    return acc;
  }, {});
}

function buildAllActions(
  sortedTraits: TraitFactory<any, any, any, any>[],
  actionsGroupKey: string,
  entityName: string,
  entitiesName: string,
  allConfigs: Record<string, any> & { [p: string]: any }
) {
  return sortedTraits.reduce((previousResult: TraitActions, factory) => {
    let result =
      factory?.actions?.({
        actionsGroupKey: actionsGroupKey,
        entityName,
        entitiesName,
        allConfigs,
      }) ?? {};
    result = previousResult ? { ...previousResult, ...result } : result;
    return result;
  }, {});
}

function buildAllSelectors(
  sortedTraits: TraitFactory<any, any, any, any>[],
  allConfigs: Record<string, any> & { [p: string]: any }
) {
  return sortedTraits.reduce((previousResult: TraitSelectors<any>, factory) => {
    let result =
      factory?.selectors?.({
        previousSelectors: previousResult,
        allConfigs,
      }) ?? {};
    result = previousResult ? { ...previousResult, ...result } : result;
    return result;
  }, {});
}

function buildAllMutators(
  sortedTraits: TraitFactory<any, any, any, any>[],
  allSelectors: TraitSelectors<any>,
  allConfigs: Record<string, any> & { [p: string]: any }
) {
  return (
    sortedTraits.reduce(
      (previousResult: TraitStateMutators<any> | undefined, factory) => {
        let result =
          factory?.mutators?.({
            allSelectors: allSelectors,
            previousMutators: previousResult,
            allConfigs,
          }) ?? {};
        result = previousResult ? { ...previousResult, ...result } : result;
        return result;
      },
      {}
    ) || {}
  );
}

function buildInitialState(
  sortedTraits: TraitFactory<any, any, any, any>[],
  allConfigs: Record<string, any> & { [p: string]: any }
) {
  return sortedTraits.reduce((previousResult: any, factory) => {
    const result =
      factory?.initialState?.({
        previousInitialState: previousResult,
        allConfigs,
      }) ??
      previousResult ??
      {};
    return result;
  }, {});
}

function buildReducer(
  sortedTraits: TraitFactory<any, any, any, any>[],
  initialState: any,
  allActions: TraitActions,
  allSelectors: TraitSelectors<any>,
  allMutators: TraitStateMutators<any>,
  allConfigs: Record<string, any> & { [p: string]: any }
) {
  return sortedTraits.reduce(
    (
      previousResult: ((state: any, action: Action) => any) | undefined,
      factory
    ) => {
      const result = factory?.reducer?.({
        initialState,
        allActions,
        allSelectors,
        allMutators,
        allConfigs,
      });
      return result && previousResult
        ? (state = initialState, action) => {
            const aState = previousResult(state, action);
            return result(aState, action);
          }
        : result ?? previousResult;
    },
    undefined
  );
}

function buildAllEffects(
  sortedTraits: TraitFactory<any, any, any, any>[],
  allActions: TraitActions,
  allFeatureSelectors: TraitSelectors<any>,
  allConfigs: Record<string, any> & { [p: string]: any }
) {
  return sortedTraits.reduce(
    (previousResult: Type<TraitEffect>[] | undefined, factory) => {
      let result =
        factory?.effects?.({
          allActions,
          allSelectors: allFeatureSelectors,
          allConfigs,
        }) ?? [];
      result = previousResult ? [...previousResult, ...result] : result;
      return result;
    },
    []
  );
}

function getSelectorsForFeature<
  State,
  S extends TraitSelectors<State>,
  // eslint-disable-next-line @typescript-eslint/ban-types
  F extends MemoizedSelector<object, any>
>(featureSelect: F, selectors: S): FeatureSelectors<State, S> {
  const ss: { [key in keyof S]?: any } = {};
  for (const prop in selectors) {
    ss[prop] = createSelector(featureSelect as any, selectors[prop] as any);
  }
  return ss as FeatureSelectors<State, S>;
}

export function setPropertyReducer<State, P extends keyof State>(
  sourceReducer: (state: State, action: ActionType<any>) => State,
  property: P,
  propertyReducer: (state: State[P], action: ActionType<any>) => State[P]
): (state: State, action: ActionType<any>) => State {
  return function reducer(state: State, action: ActionType<any>): State {
    const sourceState = sourceReducer(state, action);
    return {
      ...sourceState,
      [property]: propertyReducer(sourceState[property], action),
    };
  };
}
export function setPropertiesReducer<State, P extends keyof State>(
  sourceReducer: (state: State, action: ActionType<any>) => State,
  propertiesReducers: {
    [key in P]: (state: State[P], action: ActionType<any>) => State[P];
  }
): (state: State, action: ActionType<any>) => State {
  return function reducer(state: State, action: ActionType<any>): State {
    const newState = { ...sourceReducer(state, action) };
    for (const property in propertiesReducers) {
      newState[property as P] = propertiesReducers[property](
        newState[property],
        action
      );
    }
    return newState;
  };
}

export function joinReducers<State>(
  firstReducer: (state: State, action: ActionType<any>) => State,
  secondReducer: (state: any, action: ActionType<any>) => any
): (state: State, action: ActionType<any>) => State {
  return function reducer(state: State, action: ActionType<any>): State {
    const sourceState = firstReducer(state, action);
    return secondReducer(sourceState, action);
  };
}

export function combineEntityFeatures<
  T extends { [key: string]: EntityFeatureFactory<any, any> },
  K extends keyof T,
  State extends { [P in K]: ExtractStateType<ReturnType<T[P]>> },
  A extends { [P in K]: ExtractActionsType<ReturnType<T[P]>> },
  S extends {
    [P in K]: FeatureSelectors<State, ExtractSelectorsType<ReturnType<T[P]>>>;
  },
  R extends (config: Config<State>) => {
    actions: A;
    selectors: S;
    reducer: (state: State, action: ActionType<any>) => State;
    effects: Type<any>[];
    initialState: State;
  }
>(traitFactoriesMap: T): R {
  return ((config: Config<any, any>) => {
    const featureSelector =
      typeof config.featureSelector === 'string'
        ? createFeatureSelector<any>(config.featureSelector)
        : config.featureSelector;
    const actions: any = {};
    const selectors: any = {};
    const reducers: any = {};
    let effects: Type<any>[] = [];
    for (const [key, entityFeatureFactory] of Object.entries(
      traitFactoriesMap
    )) {
      const selector = createSelector(
        featureSelector,
        (state: any) => state[key]
      );
      const featureTraits = entityFeatureFactory({
        actionsGroupKey: config.actionsGroupKey,
        featureSelector: selector,
      });
      actions[key] = featureTraits.actions;
      selectors[key] = featureTraits.selectors;
      reducers[key] = featureTraits.reducer;
      effects = [...effects, ...featureTraits.effects];
    }
    return {
      actions,
      selectors,
      reducer: combineReducers(reducers),
      effects,
    };
  }) as R;
}

export function mixEntityFeatures<
  T extends { [key: string]: EntityFeatureFactory<any, any> },
  K extends keyof T,
  State extends { [P in K]: ExtractStateType<ReturnType<T[P]>> },
  A extends TraitActions &
    UnionToIntersection<ExtractActionsType<ReturnType<T[K]>>>,
  S extends TraitSelectors<any> &
    UnionToIntersection<
      FeatureSelectors<State, ExtractSelectorsType<ReturnType<T[K]>>>
    >,
  R extends EntityFeatureFactory<any, any, State, A, S>
>(traitFactoriesMap: T): R {
  return ((config: Config<any, any>) => {
    const featureSelector =
      typeof config.featureSelector === 'string'
        ? createFeatureSelector<any>(config.featureSelector)
        : config.featureSelector;
    let actions: any = {};
    let selectors: any = {};
    const reducers: any = {};
    let effects: Type<any>[] = [];
    for (const [key, entityFeatureFactory] of Object.entries(
      traitFactoriesMap
    )) {
      const selector = createSelector(
        featureSelector,
        (state: any) => state[key]
      );
      const featureTraits = entityFeatureFactory({
        actionsGroupKey: config.actionsGroupKey,
        featureSelector: selector,
      });
      actions = { ...actions, ...featureTraits.actions };
      selectors = { ...selectors, ...featureTraits.selectors };
      reducers[key] = featureTraits.reducer;
      effects = [...effects, ...featureTraits.effects];
    }
    return {
      actions,
      selectors,
      reducer: combineReducers(reducers),
      effects,
    };
  }) as R;
}

export function addEntityFeaturesProperties<
  F extends EntityFeatureFactory<any, any>,
  T extends { [key: string]: EntityFeatureFactory<any, any, any, any, any> },
  K extends keyof T,
  State extends ExtractStateType<ReturnType<F>> &
    {
      [P in K]: ExtractStateType<ReturnType<T[P]>>;
    },
  A extends ExtractActionsType<ReturnType<F>> &
    { [P in K]: ExtractActionsType<ReturnType<T[P]>> },
  S extends FeatureSelectors<State, ExtractSelectorsType<ReturnType<F>>> &
    {
      [P in K]: FeatureSelectors<State, ExtractSelectorsType<ReturnType<T[P]>>>;
    },
  R extends (config: Config<State>) => {
    actions: A;
    selectors: S;
    reducer: (state: State, action: ActionType<any>) => State;
    effects: Type<any>[];
    initialState: State;
  }
>(targetTraitFactory: F, traitFactoriesMap: T): R {
  return ((config: Config<any, any>) => {
    const featureSelector =
      typeof config.featureSelector === 'string'
        ? createFeatureSelector<any>(config.featureSelector)
        : config.featureSelector;
    const targetFeatureTraits = targetTraitFactory({
      actionsGroupKey: config.actionsGroupKey,
      featureSelector: featureSelector,
    });
    const actions: any = { ...targetFeatureTraits.actions };
    const selectors: any = { ...targetFeatureTraits.selectors };
    const reducers: any = {};
    let effects: Type<any>[] = [...targetFeatureTraits.effects];
    for (const [key, entityFeatureFactory] of Object.entries(
      traitFactoriesMap
    )) {
      const selector = createSelector(
        featureSelector,
        (state: any) => state[key]
      );
      const featureTraits = entityFeatureFactory({
        actionsGroupKey: config.actionsGroupKey,
        featureSelector: selector,
      });
      actions[key] = featureTraits.actions;
      selectors[key] = featureTraits.selectors;
      reducers[key] = featureTraits.reducer;
      effects = [...effects, ...featureTraits.effects];
    }
    return {
      actions,
      selectors,
      reducer: setPropertiesReducer(targetFeatureTraits.reducer, reducers),
      effects,
    };
  }) as R;
}

// export

/// products:{actions, selectors, }, orders: {actions,slectors}
/// { actions: {ProductActions, OrderActions}, selectors: {ProductSelectors, OrderSelectors}
// TODO finish implementing combineTrais and addPropertiesTraits
// TODO finish renaming traits
