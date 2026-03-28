// 'use client';
// import * as Dialog from '@radix-ui/react-dialog';
// import { useState, useEffect } from 'react';
// import Image from 'next/image';

// interface CustomizeChannelDialogProps {
//   initialValues: {
//     bgColor: string;
//     fontSize: string;
//     textColor: string;
//     title: string;
//     description: string;
//     logo?: string;
//   };
//   onSave: (newSettings: {
//     bgColor: string;
//     fontSize: string;
//     textColor: string;
//     title: string;
//     description: string;
//     logo?: string;
//   }) => void;
// }

// export function CustomizeChannelDialog({ initialValues, onSave }: CustomizeChannelDialogProps) {
//   // Use a single state object to manage all values.
//   const [settings, setSettings] = useState({
//     bgColor: initialValues.bgColor,
//     fontSize: initialValues.fontSize,
//     textColor: initialValues.textColor,
//     title: initialValues.title,
//     description: initialValues.description,
//     logo: initialValues.logo || '',
//   });

//   // Update state if initial values change.
//   useEffect(() => {
//     setSettings({
//       bgColor: initialValues.bgColor,
//       fontSize: initialValues.fontSize,
//       textColor: initialValues.textColor,
//       title: initialValues.title,
//       description: initialValues.description,
//       logo: initialValues.logo || '',
//     });
//   }, [initialValues]);

//   const presetBgColors = ['white', 'red', 'green', 'blue', 'yellow', 'orange'];
//   const presetTextColors = ['black', 'red', 'green', 'blue', 'purple', 'gray'];

//   // Update the logo preview when a file is selected.
//   const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       const fileUrl = URL.createObjectURL(e.target.files[0]);
//       setSettings((prev) => ({ ...prev, logo: fileUrl }));
//     }
//   };

//   const handleSave = () => {
//     localStorage.setItem('channelCustomization', JSON.stringify(settings));
//     onSave(settings);
//   };

//   return (
//     <Dialog.Root>
//       <Dialog.Trigger asChild>
//         <button className="rounded-md bg-background-gray px-4 py-2 hover:bg-gray-200 transition-colors">
//           Customize Channel
//         </button>
//       </Dialog.Trigger>
//       <Dialog.Portal>
//         <Dialog.Overlay className="fixed inset-0 bg-black opacity-70" />
//         <Dialog.Content className="fixed top-1/2 left-1/2 max-w-xl max-h-[32rem] overflow-y-auto w-full p-6 bg-white rounded-md shadow-lg transform -translate-x-1/2 -translate-y-1/2">
//           <Dialog.Title className="text-2xl font-bold text-center mb-6">Customize Channel</Dialog.Title>
//           <div className="space-y-6">
//             {/* Title and Description */}
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">Channel Title</label>
//                 <input
//                   type="text"
//                   value={settings.title}
//                   onChange={(e) => setSettings((prev) => ({ ...prev, title: e.target.value }))}
//                   className="w-full p-2 border rounded-md"
//                   placeholder="Enter channel title"
//                 />
//               </div>
//               <div>
//                 <label className="block text-sm font-medium text-gray-700 mb-1">Channel Description</label>
//                 <input
//                   type="text"
//                   value={settings.description}
//                   onChange={(e) => setSettings((prev) => ({ ...prev, description: e.target.value }))}
//                   className="w-full p-2 border rounded-md"
//                   placeholder="Enter description"
//                 />
//               </div>
//             </div>

//             {/* Logo Section */}
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Brand Logo</label>
//               <div className="w-full flex flex-col">
//                 <div className="border-dashed border-2 border-gray-300 rounded-md py-4 w-full h-40 flex justify-center items-center mb-4">
//                   {settings.logo ? (
//                     <Image
//                       src={settings.logo}
//                       width={90}
//                       height={90}
//                       alt="Logo Preview"
//                       // className="w-40 h-40 object-contain"
//                     />
//                   ) : (
//                     <span className="text-gray-500">No logo uploaded</span>
//                   )}
//                   <input type="file" id="logoUpload" accept="image/*" className="hidden" onChange={handleLogoUpload} />
//                 </div>
//                 <div className="w-full text-right">
//                   <button
//                     className="bg-blue-600 text-white px-4 py-2 rounded-md"
//                     onClick={() => document.getElementById('logoUpload')?.click()}
//                   >
//                     Upload Image
//                   </button>
//                 </div>
//               </div>
//             </div>

//             {/* Background Color */}
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Background Color</label>
//               <div className="flex items-center space-x-2">
//                 {presetBgColors.map((color) => (
//                   <button
//                     key={color}
//                     type="button"
//                     onClick={() => setSettings((prev) => ({ ...prev, bgColor: color }))}
//                     className={`w-8 h-8 rounded-full border ${
//                       settings.bgColor === color ? 'ring-2 ring-main-blue' : 'ring-0'
//                     }`}
//                     style={{ backgroundColor: color }}
//                   />
//                 ))}
//                 <input
//                   type="color"
//                   value={settings.bgColor}
//                   onChange={(e) => setSettings((prev) => ({ ...prev, bgColor: e.target.value }))}
//                   className="w-8 h-8 p-0 border-0"
//                 />
//               </div>
//             </div>

//             {/* Font Size */}
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Font Size (px)</label>
//               <div className="flex items-center space-x-3">
//                 <input
//                   type="range"
//                   min="12"
//                   max="24"
//                   value={settings.fontSize}
//                   onChange={(e) => setSettings((prev) => ({ ...prev, fontSize: e.target.value }))}
//                   className="w-full"
//                 />
//                 <span className="w-10 text-center">{settings.fontSize}px</span>
//               </div>
//             </div>

//             {/* Text Color */}
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Text Color</label>
//               <div className="flex items-center space-x-2">
//                 {presetTextColors.map((color) => (
//                   <button
//                     key={color}
//                     type="button"
//                     onClick={() => setSettings((prev) => ({ ...prev, textColor: color }))}
//                     className={`w-8 h-8 rounded-full border ${
//                       settings.textColor === color ? 'ring-2 ring-main-blue' : 'ring-0'
//                     }`}
//                     style={{ backgroundColor: color }}
//                   />
//                 ))}
//                 <input
//                   type="color"
//                   value={settings.textColor}
//                   onChange={(e) => setSettings((prev) => ({ ...prev, textColor: e.target.value }))}
//                   className="w-8 h-8 p-0 border-0"
//                 />
//               </div>
//             </div>
//           </div>

//           <div className="mt-6 flex justify-end space-x-4">
//             <Dialog.Close asChild>
//               <button className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400 transition-colors">Cancel</button>
//             </Dialog.Close>
//             <Dialog.Close asChild>
//               <button
//                 onClick={handleSave}
//                 className="px-4 py-2 bg-main-blue text-white rounded-md hover:bg-blue-600 transition-colors"
//               >
//                 Save
//               </button>
//             </Dialog.Close>
//           </div>
//         </Dialog.Content>
//       </Dialog.Portal>
//     </Dialog.Root>
//   );
// }

'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { RotatingLines } from 'react-loader-spinner';
import { updateStream, uploadImage } from '@/lib/supabase-service';

interface CustomizeChannelDialogProps {
  playbackId: string;
  initialValues: {
    bgColor: string;
    fontSize: string;
    textColor: string;
    title: string;
    description: string;
    logo: string;
  };
  onSave: (newSettings: {
    bgColor: string;
    fontSize: string;
    textColor: string;
    title: string;
    description: string;
    logo: string;
  }) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CustomizeChannelDialog({ playbackId, initialValues, onSave, open, onOpenChange }: CustomizeChannelDialogProps) {
  const [settings, setSettings] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const prevOpenRef = useRef(open);

  // Only sync settings when dialog opens (not when initialValues changes while closed)
  useEffect(() => {
    // If dialog just opened (was closed, now open), sync settings
    if (open && !prevOpenRef.current) {
      setSettings(initialValues);
    }
    prevOpenRef.current = open;
  }, [open, initialValues]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show loading state
    const prevLogo = settings.logo;
    setSettings((prev) => ({ ...prev, logo: '' }));

    try {
      const imageUrl = await uploadImage(file, "stream-logos");
      
      if (imageUrl) {
        setSettings((prev) => ({
          ...prev,
          logo: imageUrl,
        }));
        toast.success('Logo uploaded successfully');
      } else {
        setSettings((prev) => ({ ...prev, logo: prevLogo }));
        toast.error('Failed to upload logo');
      }
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      setSettings((prev) => ({ ...prev, logo: prevLogo }));
      toast.error(error.message || 'Failed to upload logo');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateStream(playbackId, {
        bgcolor: settings.bgColor,
        color: settings.textColor,
        fontSize: parseInt(settings.fontSize),
        title: settings.title,
        description: settings.description,
        logo: settings.logo || '',
      });
      toast.success('Channel updated successfully!');
      onSave({ ...settings, fontSize: parseInt(settings.fontSize).toString() });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update channel');
    } finally {
      setSaving(false);
    }
  };

  const presetBgColors = ['#ffffff', 'red', 'green', 'blue', 'yellow', 'orange'];
  const presetTextColors = ['#000000', 'red', 'green', 'blue', 'purple', 'gray'];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button className="rounded-md bg-background-gray px-4 py-2 hover:bg-gray-200">Customize Channel</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black opacity-70" />
        <Dialog.Content className="fixed top-1/2 left-1/2 max-w-xl max-h-[32rem] overflow-y-auto w-full p-6 bg-white rounded-md shadow-lg -translate-x-1/2 -translate-y-1/2">
          <Dialog.Title className="text-2xl font-bold text-center mb-6">Customize Channel</Dialog.Title>
          <Dialog.Description className="sr-only">
            Customize your channel appearance settings
          </Dialog.Description>
          <div className="space-y-6">
            {/* Title + Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-1">Channel Title</label>
                <input
                  type="text"
                  value={settings.title}
                  onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                />
              </div>
              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={settings.description}
                  onChange={(e) => setSettings((s) => ({ ...s, description: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                />
              </div>
            </div>

            {/* Logo */}
            <div>
              <label className="block text-sm font-medium mb-1">Brand Logo</label>
              <div className="border-dashed border-2 border-gray-300 rounded-md py-4 h-40 flex justify-center items-center mb-2">
                {settings.logo ? (
                  <Image src={settings.logo} width={90} height={90} alt="Logo Preview" />
                ) : (
                  <span className="text-gray-500">No logo uploaded</span>
                )}
              </div>
              <button
                onClick={() => document.getElementById('logoUpload')?.click()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md"
                disabled={saving}
              >
                Upload Image
              </button>
              <input id="logoUpload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>

            {/* Background Color */}
            <div>
              <label className="block text-sm font-medium mb-1">Background</label>
              <div className="flex items-center space-x-2">
                {presetBgColors.map((col) => (
                  <button
                    key={col}
                    onClick={() => setSettings((s) => ({ ...s, bgColor: col }))}
                    className={`w-8 h-8 rounded-full border ${settings.bgColor === col ? 'ring-2 ring-main-blue' : ''}`}
                    style={{ backgroundColor: col }}
                    disabled={saving}
                  />
                ))}
                <input
                  type="color"
                  value={settings.bgColor}
                  onChange={(e) => setSettings((s) => ({ ...s, bgColor: e.target.value }))}
                  className="w-8 h-8 p-0 border-0"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Font Size */}
            <div>
              <label className="block text-sm font-medium mb-1">Font Size</label>
              <div className="flex items-center space-x-3">
                <input
                  type="range"
                  min="12"
                  max="36"
                  value={settings.fontSize}
                  onChange={(e) => setSettings((s) => ({ ...s, fontSize: e.target.value }))}
                  className="w-full"
                  disabled={saving}
                />
                <span>{settings.fontSize}px</span>
              </div>
            </div>

            {/* Text Color */}
            <div>
              <label className="block text-sm font-medium mb-1">Text Color</label>
              <div className="flex items-center space-x-2">
                {presetTextColors.map((col) => (
                  <button
                    key={col}
                    onClick={() => setSettings((s) => ({ ...s, textColor: col }))}
                    className={`w-8 h-8 rounded-full border ${
                      settings.textColor === col ? 'ring-2 ring-main-blue' : ''
                    }`}
                    style={{ backgroundColor: col }}
                    disabled={saving}
                  />
                ))}
                <input
                  type="color"
                  value={settings.textColor}
                  onChange={(e) => setSettings((s) => ({ ...s, textColor: e.target.value }))}
                  className="w-8 h-8 p-0 border-0"
                  disabled={saving}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end space-x-4">
            <Dialog.Close asChild>
              <button className="px-4 py-2 bg-gray-300 rounded-md hover:bg-gray-400" disabled={saving}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-main-blue text-white rounded-md hover:bg-blue-600"
            >
              {saving ? (
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
