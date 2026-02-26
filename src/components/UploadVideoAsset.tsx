'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { clsx } from 'clsx';
import { RotatingLines } from 'react-loader-spinner';
import * as tus from 'tus-js-client';
import api from '@/utils/api';
import { usePrivy } from '@privy-io/react-auth';
import { toast } from 'sonner';
import { useDispatch } from 'react-redux';
import { getAssets } from '@/features/assetsAPI';
import { AppDispatch } from '@/store/store';
import { createVideo, updateVideo } from '@/lib/supabase-service';
import InputField from './ui/InputField';

type viewMode = 'free' | 'one-time' | 'monthly';
export type VideoUploadNotice = {
  phase: 'uploading' | 'saving' | 'pending-metadata' | 'completed' | 'error';
  title: string;
  progress: number;
  message?: string;
};

export default function UploadVideoAsset({
  onClose,
  onStatusChange,
}: {
  onClose: () => void;
  onStatusChange?: (status: VideoUploadNotice | null) => void;
}) {
  const { user } = usePrivy();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [viewMode, setviewMode] = useState<viewMode>('free');
  const [amount, setAmount] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ amount?: string }>({});
  const [presetValues, setPresetValues] = useState<number[]>([0, 0, 0, 0]);
  const [pendingMetadata, setPendingMetadata] = useState<{
    playbackId: string;
    assetName: string;
  } | null>(null);

  const dispatch = useDispatch<AppDispatch>();

  const emitStatus = useCallback(
    (status: VideoUploadNotice | null) => {
      onStatusChange?.(status);
    },
    [onStatusChange],
  );

  useEffect(() => {
    return () => {
      emitStatus(null);
    };
  }, [emitStatus]);
  
  // Get creator address (wallet address)
  // First try to use the login method if it's a wallet, otherwise find a wallet from linked accounts
  const creatorAddress = React.useMemo(() => {
    if (!user?.linkedAccounts || user.linkedAccounts.length === 0) return null;
    
    // Check if primary login method is a wallet
    const firstAccount = user.linkedAccounts[0];
    if (firstAccount.type === 'wallet' && 'address' in firstAccount && firstAccount.address) {
      return firstAccount.address;
    }
    
    // Find a wallet from linked accounts
    const walletAccount = user.linkedAccounts.find((account: any) => account.type === 'wallet' && 'address' in account && account.address);
    if (walletAccount && 'address' in walletAccount && walletAccount.address) {
      return walletAccount.address;
    }
    
    return null;
  }, [user?.linkedAccounts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setFile(e.target.files[0]);
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleviewModeChange = (option: viewMode) => {
    setviewMode(option);
    setErrors((prev) => ({ ...prev, amount: undefined })); // Clear amount error when switching options
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (isNaN(value) || value <= 0) {
      setErrors((prev) => ({ ...prev, amount: 'Please enter a valid amount.' }));
    } else {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
    setAmount(value);
  };

  const handlePresetChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const newVals = [...presetValues];
    newVals[index] = parseFloat(e.target.value) || 0;
    setPresetValues(newVals);
  };

  const saveVideoMetadata = useCallback(
    async ({ playbackId, assetName }: { playbackId: string; assetName: string }) => {
      if (!creatorAddress) {
        throw new Error('Wallet address not found. Please connect a wallet.');
      }

      const metadataPayload = {
        playbackId,
        viewMode: viewMode || 'free',
        amount: amount || null,
        assetName: assetName || title,
        creatorId: creatorAddress,
        Users: [],
        donations: presetValues || [],
      };

      const maxAttempts = 3;
      let lastError: any = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          await createVideo(metadataPayload);
          return;
        } catch (saveError: any) {
          lastError = saveError;
          const message = String(saveError?.message || '');
          const isDuplicate =
            message.toLowerCase().includes('duplicate key') ||
            message.toLowerCase().includes('unique constraint');

          if (isDuplicate) {
            await updateVideo(playbackId, {
              viewMode: metadataPayload.viewMode,
              amount: metadataPayload.amount,
              assetName: metadataPayload.assetName,
              creatorId: metadataPayload.creatorId,
              Users: metadataPayload.Users,
              donations: metadataPayload.donations,
            });
            return;
          }

          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, attempt * 500));
          }
        }
      }

      throw lastError || new Error('Failed to save video metadata');
    },
    [amount, creatorAddress, presetValues, title, viewMode],
  );

  const handleRetryMetadataSave = useCallback(async () => {
    if (!pendingMetadata) return;
    setSavingMetadata(true);
    setError(null);
    emitStatus({
      phase: 'saving',
      title: pendingMetadata.assetName || title || 'Video upload',
      progress: 100,
      message: 'Retrying metadata save…',
    });
    try {
      await saveVideoMetadata(pendingMetadata);
      emitStatus({
        phase: 'completed',
        title: pendingMetadata.assetName || title || 'Video upload',
        progress: 100,
        message: 'Video metadata saved. Upload is complete.',
      });
      toast.success('Video metadata saved successfully!');
      setPendingMetadata(null);
      dispatch(getAssets());
      onClose();
    } catch (err: any) {
      const errorMessage = err?.message || err?.toString() || 'Failed to save video metadata';
      setError(`Metadata save failed: ${errorMessage}`);
      emitStatus({
        phase: 'pending-metadata',
        title: pendingMetadata.assetName || title || 'Video upload',
        progress: 100,
        message: 'Upload finished but metadata save failed. Re-open and retry metadata save.',
      });
      toast.error('Metadata save failed. Please retry.');
    } finally {
      setSavingMetadata(false);
    }
  }, [dispatch, emitStatus, onClose, pendingMetadata, saveVideoMetadata, title]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a video file.');
      return;
    }
    if (!title) {
      setError('Please add file name.');
      return;
    }
    if (error) {
      toast.error(error);
      return;
    }
    setError(null);
    setUploading(true);
    setProgress(0);
    setPendingMetadata(null);
    emitStatus({
      phase: 'uploading',
      title: title || file.name || 'Video upload',
      progress: 0,
      message: 'Upload started',
    });

    try {
      if (!creatorAddress) {
        throw new Error('Wallet address not found. Please connect a wallet.');
      }

      const requesterCreatorId = creatorAddress.trim().toLowerCase();
      const response = await api.post('/asset/request-upload', {
        name: title,
        creatorId: {
          type: 'unverified',
          value: creatorAddress,
        },
      }, {
        headers: {
          'x-creator-id': requesterCreatorId,
        },
      });

      const { playbackId, name } = response.data.asset;

      if (response.status !== 200) {
        throw new Error('Failed to request upload URL');
      }

      const { tusEndpoint } = response.data;

      if (!tusEndpoint) {
        throw new Error('tusEndpoint not provided');
      }
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: tusEndpoint,
          metadata: {
            filename: file.name,
            filetype: file.type,
          },
          uploadSize: file.size,
          onError: (err) => {
            reject(err);
          },
          onProgress: (bytesUploaded, bytesTotal) => {
            const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
            const parsedPercentage = parseFloat(percentage);
            setProgress(parsedPercentage);
            emitStatus({
              phase: 'uploading',
              title: name || title || file.name || 'Video upload',
              progress: parsedPercentage,
              message: `Uploading… ${parsedPercentage.toFixed(0)}%`,
            });
          },
          onSuccess: () => {
            resolve();
          },
        });
        upload
          .findPreviousUploads()
          .then((previousUploads) => {
            if (previousUploads.length > 0) {
              upload.resumeFromPreviousUpload(previousUploads[0]);
            }
            upload.start();
          })
          .catch(reject);
      });

      setUploading(false);
      setSavingMetadata(true);
      emitStatus({
        phase: 'saving',
        title: name || title || file.name || 'Video upload',
        progress: 100,
        message: 'Upload complete. Saving metadata…',
      });

      try {
        await saveVideoMetadata({
          playbackId,
          assetName: name || title,
        });
        emitStatus({
          phase: 'completed',
          title: name || title || file.name || 'Video upload',
          progress: 100,
          message: 'Video uploaded successfully.',
        });
        toast.success('Video uploaded successfully!');
        dispatch(getAssets());
        setFile(null);
        setTitle('');
        setProgress(0);
        onClose();
      } catch (metadataError: any) {
        const metadataMessage =
          metadataError?.message || metadataError?.toString() || 'Failed to save video metadata';
        setPendingMetadata({
          playbackId,
          assetName: name || title,
        });
        setError(
          `Upload succeeded, but metadata save failed. Please retry metadata save. (${metadataMessage})`,
        );
        emitStatus({
          phase: 'pending-metadata',
          title: name || title || file.name || 'Video upload',
          progress: 100,
          message: 'Upload complete, metadata failed. Re-open and tap Retry Metadata Save.',
        });
        toast.error('Upload completed, but metadata was not saved.');
      } finally {
        setSavingMetadata(false);
      }
    } catch (err: any) {
      console.error(err);
      setError('Upload failed: ' + err.toString());
      emitStatus({
        phase: 'error',
        title: title || file.name || 'Video upload',
        progress,
        message: 'Upload failed. Please try again.',
      });
      setUploading(false);
      setSavingMetadata(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto mx-auto  p-6 pt-3 bg-white rounded-md shadow-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={clsx(
            'border-dashed border-4 border-gray-300 rounded-md p-6 w-full h-full text-center cursor-pointer transition-colors relative',
            {
              'bg-gray-50 hover:bg-gray-100': !file,
              'bg-gray-200': file,
            },
          )}
        >
          {file ? (
            <div>
              <p className="mb-2 font-medium">File Selected:</p>
              <p className="text-gray-700 break-all">{file.name}</p>
              {file.type.startsWith('video') && (
                <div className="mt-4 w-full overflow-hidden">
                  <video src={URL.createObjectURL(file)} controls className="w-full h-40 object-contain" />
                </div>
              )}
            </div>
          ) : (
            <div className="relative h-32 flex justify-center items-center flex-col">
              <p className="mb-2 font-medium">Drag &amp; drop a video file here</p>
              <p className="text-sm text-gray-600">or click to select a file</p>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your video"
            className="border rounded p-2 focus:outline-none focus:ring-1 focus:ring-main-blue transition duration-200"
          />
        </div>
        <div className="flex flex-col">
          <label className="block text-sm font-medium pb-2 text-gray-900">View Mode</label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => handleviewModeChange('free')}
              className={clsx(
                'px-4 py-2 border rounded-md transition duration-200',
                viewMode === 'free' ? 'bg-main-blue text-white' : 'bg-white text-gray-700 hover:bg-gray-100',
              )}
            >
              Free
            </button>
            <button
              type="button"
              onClick={() => handleviewModeChange('one-time')}
              className={clsx(
                'px-4 py-2 border rounded-md transition duration-200',
                viewMode === 'one-time' ? 'bg-main-blue text-white' : 'bg-white text-gray-700 hover:bg-gray-100',
              )}
            >
              One-time
            </button>
            <button
              type="button"
              onClick={() => handleviewModeChange('monthly')}
              className={clsx(
                'px-4 py-2 border rounded-md transition duration-200',
                viewMode === 'monthly' ? 'bg-main-blue text-white' : 'bg-white text-gray-700 hover:bg-gray-100',
              )}
            >
              Monthly
            </button>
          </div>
        </div>

        {viewMode !== 'free' && (
          <div className="flex flex-col">
            <label htmlFor="amount" className="block text-sm font-medium pb-2 text-gray-900">
              Amount
            </label>
            <InputField
              type="number"
              label="Amount"
              name="amount"
              value={amount?.toString() || ''}
              onChange={handleAmountChange}
              placeholder="Enter amount"
              min="0.01"
              step="0.01"
              className={clsx(
                'border w-full focus:outline-none placeholder:text-black-tertiary-text focus:ring-1 focus:ring-main-blue transition duration-200',
                { 'border-red-500': errors.amount },
              )}
            />
            {errors.amount && <p className="text-red-500 text-sm pb-1">{errors.amount}</p>}
          </div>
        )}

        {/* <div className="flex flex-col">
          <label className="text-sm pb-1 font-medium text-black">Donation Presets</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {presetValues.map((value, i) => (
              <input
                key={i}
                type="text"
                className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:text-black"
                value={value}
                onChange={(e) => handlePresetChange(i, e)}
                min="0"
                placeholder={`Preset Amount ${i + 1}`}
              />
            ))}
          </div>
        </div> */}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {uploading && (
          <div className="flex flex-col w-full gap-2">
            <div className="flex items-center gap-4">
              <RotatingLines
                visible={true}
                strokeWidth="5"
                animationDuration="0.75"
                strokeColor="#main-blue"
                ariaLabel="upload-loading"
                width="24"
              />
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
              <div className="h-full bg-main-blue transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || savingMetadata}
          className="mt-2 flex items-center justify-center gap-2 bg-main-blue text-white rounded-md px-4 py-2 hover:bg-blue-700 transition duration-200 disabled:opacity-50"
        >
          {uploading || savingMetadata ? (
            <RotatingLines
              visible={true}
              strokeWidth="5"
              animationDuration="0.75"
              strokeColor="#fff"
              ariaLabel="upload-loading"
              width="20"
            />
          ) : (
            'Upload Video'
          )}
        </button>

        {pendingMetadata && (
          <button
            type="button"
            onClick={handleRetryMetadataSave}
            disabled={savingMetadata}
            className="mt-2 flex items-center justify-center gap-2 border border-main-blue text-main-blue rounded-md px-4 py-2 hover:bg-main-blue hover:text-white transition duration-200 disabled:opacity-50"
          >
            {savingMetadata ? 'Retrying metadata save...' : 'Retry Metadata Save'}
          </button>
        )}
      </form>
    </div>
  );
}

export function UploadAdsAsset({ onClose }: { onClose: () => void }) {
  const { user } = usePrivy();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const dispatch = useDispatch<AppDispatch>();

  const validateFile = async (file: File) => {
    // Validate file size (max 4MB)
    if (file.size > 4 * 1024 * 1024) {
      setError('File size must not exceed 4MB.');
      return;
    }

    // Validate video length (max 30 seconds)
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);

    return new Promise<boolean>((resolve) => {
      video.onloadedmetadata = () => {
        if (video.duration > 30) {
          toast.error('Video length must not exceed 30 seconds.');
          resolve(false);
        } else {
          resolve(true);
        }
      };
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const isValid = await validateFile(selectedFile);
      if (isValid) {
        setFile(selectedFile);
        setError(null);
      }
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const isValid = await validateFile(droppedFile);
      if (isValid) {
        setFile(droppedFile);
        setError(null);
      }
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log('title', title);
    if (!file) {
      setError('Please select a video file.');
      return;
    }
    if (title.trim() == '') {
      setError('Please add file name.');
      return;
    }
    if (error) {
      toast.error(error);
      return;
    }
    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const walletAddress = user?.wallet?.address?.trim().toLowerCase();
      if (!walletAddress) {
        throw new Error('Wallet address not found. Please connect a wallet.');
      }

      const response = await api.post('/asset/request-upload', {
        name: title,
        creatorId: {
          type: 'unverified',
          value: walletAddress,
        },
      }, {
        headers: {
          'x-creator-id': walletAddress,
        },
      });

      if (response.status !== 200) {
        throw new Error('Failed to request upload URL');
      }

      const { tusEndpoint } = response.data;
      if (!tusEndpoint) {
        throw new Error('tusEndpoint not provided');
      }

      // Create a tus upload instance
      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        metadata: {
          filename: file.name,
          filetype: file.type,
        },
        uploadSize: file.size,
        onError: (err) => {
          console.error('Error uploading file:', err);
          setError('Error uploading file: ' + err.toString());
          setUploading(false);
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percentage = ((bytesUploaded / bytesTotal) * 100).toFixed(2);
          setProgress(parseFloat(percentage));
        },

        onSuccess: () => {
          setUploading(false);
          toast.success('Ad video uploaded successfully!');
          onClose();
          dispatch(getAssets());
          // Reset form
          setFile(null);
          setTitle('');
          setProgress(0);
        },
      });

      // Check for previous uploads to resume if available
      const previousUploads = await upload.findPreviousUploads();
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }

      upload.start();
    } catch (err: any) {
      console.error(err);
      setError('Upload failed: ' + err.toString());
      setUploading(false);
    }
  };

  return (
    <div className="w-full h-full overflow-y-auto mx-auto  p-6 pt-3 bg-white rounded-md shadow-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={clsx(
            'border-dashed border-4 border-gray-300 rounded-md p-6 w-full h-full text-center cursor-pointer transition-colors relative',
            {
              'bg-gray-50 hover:bg-gray-100': !file,
              'bg-gray-200': file,
            },
          )}
        >
          {file ? (
            <div>
              <p className="mb-2 font-medium">File Selected:</p>
              <p className="text-gray-700 break-all">{file.name}</p>
              {file.type.startsWith('video') && (
                <div className="mt-4 w-full overflow-hidden">
                  <video src={URL.createObjectURL(file)} controls className="w-full h-40 object-contain" />
                </div>
              )}
            </div>
          ) : (
            <div className="relative h-32 flex justify-center items-center flex-col">
              <p className="mb-2 font-medium">Drag &amp; drop a video file here</p>
              <p className="text-sm text-gray-600">or click to select a file</p>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your ad video"
            className="border rounded p-2 focus:outline-none focus:ring-1 focus:ring-main-blue transition duration-200"
          />
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {uploading && (
          <div className="flex flex-col w-full gap-2">
            <div className="flex items-center gap-4">
              <RotatingLines
                visible={true}
                strokeWidth="5"
                animationDuration="0.75"
                strokeColor="#main-blue"
                ariaLabel="upload-loading"
                width="24"
              />
              <span className="text-sm font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded h-2 overflow-hidden">
              <div className="h-full bg-main-blue transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading}
          className="mt-2 flex items-center justify-center gap-2 bg-main-blue text-white rounded-md px-4 py-2 hover:bg-blue-700 transition duration-200 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Upload Ad Video'}
        </button>
      </form>
    </div>
  );
}
