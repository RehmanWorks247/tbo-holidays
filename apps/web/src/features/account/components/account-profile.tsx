'use client';

import { useAuth } from '@clerk/nextjs';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type UpdateProfileRequest,
  updateProfileRequestSchema,
  type UserResponse,
} from '@hotel/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

import { RequestError } from '@/components/shared/request-error';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { accountKey, useAccount } from '@/features/account/queries/use-account';
import { usePageMessages } from '@/providers/use-page-messages';
import { requireSessionToken } from '@/services/api/api-client';
import { usersApi } from '@/services/api/users.api';

function ProfileForm({ user }: { user: UserResponse }) {
  const {
    messages: { results: messages },
  } = usePageMessages();
  const { userId, getToken } = useAuth();
  const client = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProfileRequest>({
    resolver: zodResolver(updateProfileRequestSchema),
    defaultValues: user.profile ?? { firstName: '', lastName: '' },
  });
  const save = useMutation({
    mutationFn: async (request: UpdateProfileRequest) =>
      usersApi.update(request, await requireSessionToken(getToken)),
    onSuccess: (data) => client.setQueryData(accountKey(userId), data),
  });
  return (
    <Card className="max-w-2xl">
      <form
        noValidate
        onSubmit={handleSubmit((request) => save.mutate(request))}
        className="space-y-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="profile-first">
              {messages.firstName}
            </label>
            <Input id="profile-first" autoComplete="given-name" {...register('firstName')} />
            {errors.firstName ? <p className="field-error">{messages.nameError}</p> : null}
          </div>
          <div>
            <label className="field-label" htmlFor="profile-last">
              {messages.lastName}
            </label>
            <Input id="profile-last" autoComplete="family-name" {...register('lastName')} />
            {errors.lastName ? <p className="field-error">{messages.nameError}</p> : null}
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="profile-phone">
            {messages.optionalPhone}
          </label>
          <Input
            id="profile-phone"
            type="tel"
            autoComplete="tel"
            {...register('phone', { setValueAs: (value: string) => value || undefined })}
          />
          {errors.phone ? <p className="field-error">{messages.phoneError}</p> : null}
        </div>
        <div>
          <label className="field-label" htmlFor="profile-nationality">
            {messages.optionalNationality}
          </label>
          <Input
            id="profile-nationality"
            maxLength={2}
            placeholder={messages.nationalityPlaceholder}
            {...register('nationality', {
              setValueAs: (value: string) => (value ? value.toUpperCase() : undefined),
            })}
          />
          {errors.nationality ? <p className="field-error">{messages.nationalityError}</p> : null}
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? messages.saving : messages.saveProfile}
        </Button>
        {save.error ? <RequestError error={save.error} /> : null}
        {save.isSuccess ? (
          <p role="status" className="text-sm">
            {messages.profileSaved}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

export function AccountProfile() {
  const {
    messages: { results: messages },
  } = usePageMessages();
  const account = useAccount();
  if (account.isPending)
    return (
      <div role="status" aria-label={messages.loadingAccount}>
        <Skeleton className="h-60 max-w-2xl" />
      </div>
    );
  if (account.error) return <RequestError error={account.error} />;
  return <ProfileForm user={account.data} />;
}
