'use client';
import type React from 'react';
import { useState } from 'react';

const Donations = () => {
  const [values, setValues] = useState(['1', '5', '10', '20']);
  const [isEditing, setIsEditing] = useState(false);

  const toggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const handleChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const newValues = [...values];
    newValues[index] = event.target.value;
    setValues(newValues);
  };

  const handleSave = () => {
    setIsEditing(false);
    // Here you would typically save the values to your backend
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6">
      {/* Configure Donations Section */}
      <h2 className="text-xl font-semibold mb-4 text-white">Configure your donation and tip options</h2>

      <div className="bg-white/5 border border-white/20 rounded-xl shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-white">Preset Donation Amount</h3>
          {!isEditing ? (
            <button
              onClick={toggleEdit}
              className="bg-gradient-to-r from-yellow-500 to-teal-500 text-black px-4 py-2 rounded-md hover:from-yellow-600 hover:to-teal-600 transition-colors"
            >
              Edit
            </button>
          ) : (
            <button
              onClick={handleSave}
              className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition-colors"
            >
              Save
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {values.map((value, index) => (
            <input
              key={index}
              type="number"
              className="w-full border border-white/20 bg-white/10 text-white rounded-lg p-3 outline-none focus:ring-2 focus:ring-yellow-500"
              value={value}
              onChange={(e) => handleChange(index, e)}
              disabled={!isEditing}
              min="0"
              placeholder={`Amount ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Donations;
