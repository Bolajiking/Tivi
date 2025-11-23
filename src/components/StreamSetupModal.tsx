'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Bars } from 'react-loader-spinner';
import * as Dialog from '@radix-ui/react-dialog';
import { IoMdClose } from 'react-icons/io';
import InputField from '@/components/ui/InputField';
import { updateStream } from '@/lib/supabase-service';
import { clsx } from 'clsx';

interface StreamSetupModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stream: {
    playbackId: string;
    streamName?: string | null;
    streamMode?: 'free' | 'one-time' | 'monthly' | null;
    streamAmount?: number | null;
    Record?: boolean | null;
  } | null;
}

type StreamMode = 'free' | 'one-time' | 'monthly';

export function StreamSetupModal({ open, onClose, onConfirm, stream }: StreamSetupModalProps) {
  const [sessionName, setSessionName] = useState('');
  const [streamMode, setStreamMode] = useState<StreamMode>('free');
  const [streamAmount, setStreamAmount] = useState<number>(0);
  const [record, setRecord] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    sessionName?: string;
    streamAmount?: string;
  }>({});

  // Load existing values when stream changes
  useEffect(() => {
    if (stream) {
      setSessionName(stream.streamName || '');
      setStreamMode(stream.streamMode || 'free');
      setStreamAmount(stream.streamAmount || 0);
      setRecord(stream.Record ?? false);
    }
  }, [stream]);

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!sessionName.trim()) {
      newErrors.sessionName = 'Session name is required';
    } else if (sessionName.trim().length < 3) {
      newErrors.sessionName = 'Session name must be at least 3 characters';
    } else if (sessionName.trim().length > 100) {
      newErrors.sessionName = 'Session name must be less than 100 characters';
    }

    // Validate amount if streamMode is not free
    if (streamMode !== 'free') {
      if (streamAmount === undefined || streamAmount === null || streamAmount <= 0 || isNaN(streamAmount)) {
        newErrors.streamAmount = 'Amount is required and must be greater than 0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirm = async () => {
    if (!stream || !stream.playbackId) {
      toast.error('Stream not found');
      return;
    }

    const isValid = validateForm();
    if (!isValid) {
      toast.error('Please fix the errors before continuing');
      return;
    }

    try {
      setLoading(true);
      
      // Update stream with new values
      await updateStream(stream.playbackId, {
        streamName: sessionName.trim(),
        streamMode: streamMode,
        streamAmount: streamMode !== 'free' ? streamAmount : null,
        Record: record,
      });

      toast.success('Stream settings updated!');
      onConfirm();
    } catch (error: any) {
      console.error('Error updating stream:', error);
      toast.error(error?.message || 'Failed to update stream settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[85vh] w-[90vw] flex mt-4 flex-col justify-center items-center max-w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-gray-900/95 backdrop-blur-sm border border-white/20 px-8 py-6 shadow-2xl z-[101]">
          <Dialog.Title className="text-white text-center text-2xl font-bold mb-2">
            Stream Session Setup
          </Dialog.Title>
          <Dialog.Description className="text-gray-300 text-center text-sm mb-6">
            Configure your stream session settings before going live
          </Dialog.Description>

          <div className="w-full space-y-4">
            {/* Session Name Input */}
            <div>
              <label className="block text-sm font-medium mb-1 text-white">
                Session Name <span className="text-red-400">*</span>
              </label>
              <InputField
                type="text"
                value={sessionName}
                onChange={(e) => {
                  setSessionName(e.target.value);
                  if (errors.sessionName) {
                    setErrors(prev => ({ ...prev, sessionName: undefined }));
                  }
                }}
                placeholder="Enter session name"
                className={`w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400 ${errors.sessionName ? 'border-red-400' : ''}`}
                maxLength={100}
              />
              {errors.sessionName && (
                <p className="text-red-400 text-xs mt-1">{errors.sessionName}</p>
              )}
            </div>

            {/* Stream Mode Input */}
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Stream Mode
              </label>
              <div className="flex gap-2 flex-wrap">
                {(['free', 'one-time', 'monthly'] as StreamMode[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setStreamMode(option);
                      // Clear amount error when mode changes
                      if (errors.streamAmount) {
                        setErrors(prev => ({ ...prev, streamAmount: undefined }));
                      }
                    }}
                    className={clsx(
                      'px-4 py-2 border capitalize text-sm rounded transition-colors',
                      streamMode === option 
                        ? 'bg-gradient-to-r from-yellow-500 to-teal-500 text-black border-transparent' 
                        : 'bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20'
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Stream Amount Input - Only show if streamMode is not free */}
            {streamMode !== 'free' && (
              <div>
                <label className="block text-sm font-medium mb-1 text-white">
                  Amount (USDC) <span className="text-red-400">*</span>
                </label>
                <InputField
                  type="number"
                  step="any"
                  min="0"
                  value={streamAmount === 0 ? '' : streamAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setStreamAmount(value);
                    if (errors.streamAmount) {
                      setErrors(prev => ({ ...prev, streamAmount: undefined }));
                    }
                  }}
                  placeholder="Enter amount in USDC"
                  className={`w-full bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400 ${errors.streamAmount ? 'border-red-400' : ''}`}
                />
                {errors.streamAmount && (
                  <p className="text-red-400 text-xs mt-1">{errors.streamAmount}</p>
                )}
              </div>
            )}

            {/* Record Input */}
            <div>
              <label className="block text-sm font-medium mb-2 text-white">
                Record
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRecord(true)}
                  className={clsx(
                    'flex-1 px-4 py-2 border capitalize text-sm rounded transition-colors',
                    record === true 
                      ? 'bg-gradient-to-r from-yellow-500 to-teal-500 text-black border-transparent' 
                      : 'bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20'
                  )}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setRecord(false)}
                  className={clsx(
                    'flex-1 px-4 py-2 border capitalize text-sm rounded transition-colors',
                    record === false 
                      ? 'bg-gradient-to-r from-yellow-500 to-teal-500 text-black border-transparent' 
                      : 'bg-white/10 backdrop-blur-sm border-white/20 text-white hover:bg-white/20'
                  )}
                >
                  No
                </button>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 w-full mt-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-teal-500 hover:from-yellow-600 hover:to-teal-600 text-black rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Bars width={16} height={16} color="#000000" />
                  <span>Saving...</span>
                </>
              ) : (
                'Continue & Go Live'
              )}
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute right-2.5 top-2.5 inline-flex size-[25px] appearance-none items-center justify-center rounded-full text-white hover:bg-white/10 focus:shadow-[0_0_0_2px] focus:shadow-yellow-500 focus:outline-none transition-colors"
              aria-label="Close"
              disabled={loading}
            >
              <IoMdClose className="text-white font-medium text-2xl" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

