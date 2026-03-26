import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'importar',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'lancamento-manual',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'cartoes',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'layouts',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'dashboard',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'faturas',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'faturas/:id',
    renderMode: RenderMode.Server,
  },
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
