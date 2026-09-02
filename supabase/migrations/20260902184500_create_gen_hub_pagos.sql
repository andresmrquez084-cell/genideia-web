create table if not exists public.gen_hub_pagos (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.gen_hub_proyectos(id) on delete cascade,
  cliente_id bigint not null references public.gen_clientes(id) on delete cascade,
  concepto text not null,
  monto numeric(12,2) not null check (monto > 0),
  moneda text not null default 'USD' check (moneda in ('USD','UYU')),
  modalidad text not null default 'pago_unico' check (modalidad in ('pago_unico','anticipo','saldo','mensual','otro')),
  porcentaje numeric(5,2) check (porcentaje is null or (porcentaje > 0 and porcentaje <= 100)),
  vencimiento date,
  metodo_recomendado text not null default 'transferencia_local' check (metodo_recomendado in ('transferencia_local','transferencia_internacional','payoneer')),
  observacion text,
  estado text not null default 'pendiente' check (estado in ('pendiente','informado','confirmado','rechazado','vencido','cancelado')),
  confirmado_en timestamp with time zone,
  creado_en timestamp with time zone not null default now(),
  actualizado_en timestamp with time zone not null default now()
);

create index if not exists gen_hub_pagos_cliente_id_idx on public.gen_hub_pagos(cliente_id);
create index if not exists gen_hub_pagos_proyecto_id_idx on public.gen_hub_pagos(proyecto_id);

alter table public.gen_hub_pagos enable row level security;

drop policy if exists gen_hub_pagos_access on public.gen_hub_pagos;
create policy gen_hub_pagos_access
on public.gen_hub_pagos for select to authenticated
using (gen_hub_is_admin() or cliente_id = gen_hub_cliente_id());

drop policy if exists gen_hub_pagos_admin_write on public.gen_hub_pagos;
create policy gen_hub_pagos_admin_write
on public.gen_hub_pagos for all to authenticated
using (gen_hub_is_admin())
with check (gen_hub_is_admin());
