import React from 'react';

const Spinner = () => {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
        <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-yellow-500" />
      </div>
    </div>
  );
};

export default Spinner;
