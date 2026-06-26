<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { page } from '$app/state';

	const redirectTo = page.url.searchParams.get('redirectTo') ?? '/';
</script>

<div class="flex min-h-screen items-center justify-center">
	<div class="w-full max-w-sm rounded-xl border p-8 shadow-sm">
		<h1 class="mb-6 text-2xl font-bold">Đăng nhập</h1>

		<button
			onclick={() => signIn('github', { redirectTo })}
			class="w-full rounded bg-gray-900 py-2 text-white hover:bg-gray-700"
		>
			Đăng nhập bằng GitHub
		</button>
	</div>
</div>

