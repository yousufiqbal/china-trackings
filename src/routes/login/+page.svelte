<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Card from '$lib/components/ui/card';
	import PackageIcon from '@lucide/svelte/icons/package';

	let { form } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Log in · Trackings</title></svelte:head>

<div class="flex min-h-[70dvh] items-center justify-center">
	<Card.Root class="w-full max-w-sm">
		<Card.Header class="items-center text-center">
			<span class="bg-primary text-primary-foreground mb-2 flex size-10 items-center justify-center rounded-lg">
				<PackageIcon class="size-5" />
			</span>
			<Card.Title class="text-xl">Trackings</Card.Title>
			<Card.Description>Sign in to manage your parcels</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				method="POST"
				class="grid gap-4"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<div class="grid gap-2">
					<Label for="username">Username</Label>
					<Input
						id="username"
						name="username"
						autocomplete="username"
						autocapitalize="none"
						spellcheck={false}
						required
						value={form?.username ?? ''}
					/>
				</div>
				<div class="grid gap-2">
					<Label for="password">Password</Label>
					<Input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
					/>
				</div>
				{#if form?.error}
					<p class="text-destructive text-sm">{form.error}</p>
				{/if}
				<Button type="submit" class="w-full" disabled={submitting}>
					{submitting ? 'Signing in…' : 'Sign in'}
				</Button>
			</form>
		</Card.Content>
	</Card.Root>
</div>
