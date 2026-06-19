<script lang="ts">
  import { ChevronLeft, ChevronRight } from '@lucide/svelte'

  let {
    page = $bindable(),
    totalPages,
    limit = $bindable(),
    onChange
  }: {
    page: number
    totalPages: number
    limit: number
    onChange: () => void
  } = $props()

  function prev() {
    if (page > 1) { page -= 1; onChange() }
  }

  function next() {
    if (page < totalPages) { page += 1; onChange() }
  }

  function onLimitChange(e: Event) {
    limit = Number((e.target as HTMLSelectElement).value)
    page = 1
    onChange()
  }
</script>

<div class="flex items-center justify-between mt-4">
  <div class="flex items-center gap-3 text-sm">
    <button
      onclick={prev}
      disabled={page <= 1}
      class="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <ChevronLeft class="w-4 h-4" /> Previous
    </button>
    <button
      onclick={next}
      disabled={page >= totalPages}
      class="flex items-center gap-1 px-2 py-1 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
    >
      Next <ChevronRight class="w-4 h-4" />
    </button>
    <span class="text-muted-foreground">{page} of {totalPages || 1}</span>
  </div>

  <div class="flex items-center gap-2 text-sm text-muted-foreground">
    Result per page
    <select value={limit} onchange={onLimitChange} class="border rounded px-2 pr-8 py-1">
      <option value={10}>10</option>
      <option value={20}>20</option>
      <option value={50}>50</option>
    </select>
  </div>
</div>