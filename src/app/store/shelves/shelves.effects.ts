import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { of, from } from 'rxjs';
import { map, catchError, switchMap, withLatestFrom, tap } from 'rxjs/operators';
import { ShelvesActions } from './shelves.actions';
import { DocumentsActions } from '../documents/documents.actions';
import { ShelfService } from '../../core/services/shelf.service';
import { IndexDBService } from '../../core/services/indexdb.service';
import { Shelf } from '../../core/models/shelf.model';
import { selectAllShelves } from './shelves.selectors';

@Injectable()
export class ShelvesEffects {
  private actions$ = inject(Actions);
  private shelfService = inject(ShelfService);
  private indexDBService = inject(IndexDBService);
  private store = inject(Store);

  loadShelves$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ShelvesActions.loadShelves),
      switchMap(() =>
        from(this.shelfService.getAllShelves()).pipe(
          map((shelves) => ShelvesActions.loadShelvesSuccess({ shelves })),
          catchError((error) =>
            of(ShelvesActions.loadShelvesFailure({ error: error.message }))
          )
        )
      )
    )
  );

  createShelf$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ShelvesActions.createShelf),
      withLatestFrom(this.store.select(selectAllShelves)),
      switchMap(([action, existingShelves]) => {
        const shelf: Shelf = {
          id: crypto.randomUUID(),
          name: action.name,
          color: action.color,
          createdAt: new Date().toISOString(),
          documentIds: [],
          order: existingShelves.length
        };
        return from(this.shelfService.saveShelf(shelf)).pipe(
          map(() => ShelvesActions.createShelfSuccess({ shelf })),
          catchError((error) =>
            of(ShelvesActions.createShelfFailure({ error: error.message }))
          )
        );
      })
    )
  );

  updateShelf$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ShelvesActions.updateShelf),
      switchMap((action) =>
        from(this.shelfService.getShelf(action.id)).pipe(
          switchMap((existingShelf) => {
            if (!existingShelf) {
              return of(ShelvesActions.updateShelfFailure({ error: 'Shelf not found' }));
            }
            const updatedShelf: Shelf = { ...existingShelf, ...action.changes };
            return from(this.shelfService.saveShelf(updatedShelf)).pipe(
              map(() => ShelvesActions.updateShelfSuccess({ shelf: updatedShelf })),
              catchError((error) =>
                of(ShelvesActions.updateShelfFailure({ error: error.message }))
              )
            );
          })
        )
      )
    )
  );

  deleteShelf$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ShelvesActions.deleteShelf),
      switchMap((action) =>
        from(this.shelfService.deleteShelf(action.id)).pipe(
          map(() => ShelvesActions.deleteShelfSuccess({ id: action.id })),
          catchError((error) =>
            of(ShelvesActions.deleteShelfFailure({ error: error.message }))
          )
        )
      )
    )
  );

  moveDocumentToShelf$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ShelvesActions.moveDocumentToShelf),
      switchMap((action) => {
        const actions = [];

        // Remove from old shelf
        if (action.fromShelfId) {
          actions.push(
            ShelvesActions.removeDocumentFromShelf({
              shelfId: action.fromShelfId,
              documentId: action.documentId
            })
          );
        }

        // Add to new shelf
        if (action.toShelfId) {
          actions.push(
            ShelvesActions.addDocumentToShelf({
              shelfId: action.toShelfId,
              documentId: action.documentId
            })
          );
        }

        return actions;
      })
    )
  );

  persistShelfChanges$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          ShelvesActions.addDocumentToShelf,
          ShelvesActions.removeDocumentFromShelf
        ),
        withLatestFrom(this.store.select(selectAllShelves)),
        tap(([action, shelves]) => {
          const shelfId = 'shelfId' in action ? action.shelfId : null;
          if (shelfId) {
            const shelf = shelves.find((s) => s.id === shelfId);
            if (shelf) {
              this.shelfService.saveShelf(shelf);
            }
          }
        })
      ),
    { dispatch: false }
  );

  persistDocumentShelfId$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ShelvesActions.moveDocumentToShelf),
        tap(async (action) => {
          const doc = await this.indexDBService.getMetadata(action.documentId);
          if (doc) {
            doc.shelfId = action.toShelfId;
            await this.indexDBService.saveMetadata(doc);
          }
        })
      ),
    { dispatch: false }
  );
}
