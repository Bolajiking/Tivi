'use client';
import { clsx } from 'clsx';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { IoMdClose } from 'react-icons/io';
import React, { useState } from 'react';
import InputField from '@/components/ui/InputField';
import { RotatingLines } from 'react-loader-spinner';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { RootState } from '@/store/store';
import { updateLivestream, getAllStreams } from '@/features/streamAPI';
import { toast } from 'sonner';
import { resetStreamStatus } from '@/features/streamSlice';

interface UpdateLivestreamProps {
  open: boolean;
  onClose: () => void;
  id: string;
  // initial values for existing stream details; adjust as available.
  name?: string;
  initialRecord?: boolean;
  // initialSuspended?: boolean;
}

export function UpdateLivestream({
  open,
  onClose,
  id,
  name = '',
  initialRecord = false,
  // initialSuspended = false,
}: UpdateLivestreamProps) {
  const [formData, setFormData] = useState({
    name: name,
    record: initialRecord,
    // record: initialSuspended,
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const dispatch = useDispatch<AppDispatch>();
  const { loading, error } = useSelector((state: RootState) => state.streams);
  // console.log(id)
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});

    // Check that name is provided
    if (!formData.name) {
      setErrors((prev) => ({ ...prev, name: 'Stream name cannot be empty' }));
      return;
    }

    // Ensure that at least one field has changed relative to the initial values
    const hasChanged = formData.name !== name || formData.record !== initialRecord;
    // formData.suspended !== initialSuspended;

    if (!hasChanged) {
      setErrors((prev) => ({
        ...prev,
        form: 'Please make changes before submitting',
      }));
      return;
    }
    try {
      await dispatch(
        updateLivestream({
          id,
          name: formData.name,
          record: formData.record,
          // suspended: formData.suspended,
        }),
      );
      toast.success('Stream updated successfully');
      dispatch(getAllStreams());
      dispatch(resetStreamStatus());
      onClose();
    } catch (err: any) {
      toast.error(error || 'Failed to update stream');
      dispatch(resetStreamStatus());
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    const { name, value, type } = target;
    const isCheckbox = type === 'checkbox';
    const checked = isCheckbox ? (target as HTMLInputElement).checked : false;
    setFormData((prev) => ({
      ...prev,
      [name]: isCheckbox ? checked : name === 'record' ? value === 'yes' : value,
    }));
    if (errors[name]) {
      setErrors((prev) => {
        const { [name]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-70" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 max-w-xl w-full -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-md shadow-lg',
          )}
        >
          <div className="flex justify-between items-center mb-4">
            <Dialog.Title className="text-lg font-semibold text-black-primary-text">Update Stream</Dialog.Title>
            <Dialog.Description className="sr-only">Update stream name and recording settings</Dialog.Description>
            <Dialog.Close asChild>
              <button onClick={onClose} className="text-2xl">
                <IoMdClose />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col">
              <label htmlFor="name" className="block text-sm font-medium pb-2 text-gray-900">
                Stream Name
              </label>
              <InputField
                type="text"
                label="Stream Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Stream Name"
                className={clsx(
                  'border w-full focus:outline-none placeholder:text-black-tertiary-text focus:ring-1 focus:ring-main-blue transition duration-200',
                  { 'border-red-500': errors.name },
                )}
              />
              {errors.name && <p className="text-red-500 text-sm pb-1">{errors.name}</p>}
            </div>
            <div className="flex flex-col">
              <label htmlFor="record" className="block text-sm font-medium text-gray-900">
                Record Stream?
              </label>
              <select
                name="record"
                value={formData.record ? 'yes' : 'no'}
                onChange={handleChange}
                className="p-3 border rounded-md focus:outline-none text-sm text-black-secondary-text focus:ring-1 focus:ring-main-blue transition duration-200"
              >
                <option value="no">Do not record</option>
                <option value="yes">Record</option>
              </select>
            </div>
            {/* <div className="flex items-center">
              <label htmlFor="suspended" className="mr-2 text-sm font-medium text-gray-900">
                Suspended:
              </label>
              <input
                type="checkbox"
                name="suspended"
                id="suspended"
                // checked={formData.suspended}
                onChange={handleChange}
                className="toggle-checkbox"
              />
            </div> */}
            {errors.form && <p className="text-red-500 text-sm">{errors.form}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center w-32 p-2 border rounded bg-main-blue text-white transition duration-200 disabled:opacity-50"
              >
                {loading ? (
                  <RotatingLines
                    visible={true}
                    strokeWidth="5"
                    animationDuration="0.75"
                    strokeColor="#ffffff"
                    ariaLabel="rotating-lines-loading"
                    width="24"
                  />
                ) : (
                  'Update'
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
