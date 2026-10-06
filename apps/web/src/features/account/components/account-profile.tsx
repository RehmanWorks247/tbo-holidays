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
import { requireSessionToken } from '@/services/api/api-client';
import { usersApi } from '@/services/api/users.api';

function ProfileForm({ user }: { user: UserResponse }) {
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
              First name
            </label>
            <Input id="profile-first" autoComplete="given-name" {...register('firstName')} />
            {errors.firstName ? <p className="field-error">{errors.firstName.message}</p> : null}
          </div>
          <div>
            <label className="field-label" htmlFor="profile-last">
              Last name
            </label>
            <Input id="profile-last" autoComplete="family-name" {...register('lastName')} />
            {errors.lastName ? <p className="field-error">{errors.lastName.message}</p> : null}
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="profile-phone">
            Phone (optional)
          </label>
          <Input
            id="profile-phone"
            type="tel"
            autoComplete="tel"
            {...register('phone', { setValueAs: (value: string) => value || undefined })}
          />
          {errors.phone ? <p className="field-error">{errors.phone.message}</p> : null}
        </div>
        <div>
          <label className="field-label" htmlFor="profile-nationality">
            Nationality (optional, 2-letter code)
          </label>
          <Input
            id="profile-nationality"
            maxLength={2}
            placeholder="e.g. PK"
            {...register('nationality', {
              setValueAs: (value: string) => (value ? value.toUpperCase() : undefined),
            })}
          />
          {errors.nationality ? (
            <p className="field-error">Enter a two-letter country code.</p>
          ) : null}
        </div>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save profile'}
        </Button>
        {save.error ? <RequestError error={save.error} /> : null}
        {save.isSuccess ? (
          <p role="status" className="text-sm">
            Profile saved.
          </p>
        ) : null}
      </form>
    </Card>
  );
}

export function AccountProfile() {
  const account = useAccount();
  if (account.isPending) return <Skeleton className="h-60 max-w-2xl" />;
  if (account.error) return <RequestError error={account.error} />;
  return <ProfileForm user={account.data} />;
}
