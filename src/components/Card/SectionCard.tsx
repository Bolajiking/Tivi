import React, { ReactNode } from 'react';

const SectionCard = ({
  children,
  title,
  contentClassName,
}: {
  children: React.ReactNode;
  title: string;
  contentClassName?: string;
}) => {
  const defaultContentClassName = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:w-[90%]';

  return (
    <section className="md:px-6 px-3 w-full py-4 pb-10 relative rounded-lg my-4 bg-white/10 backdrop-blur-sm border border-white/20">
      <div className="w-full h-full">
        <div className="flex flex-col justify-center  gap-y-3">
          <div>
            <p className="text-xl font-bold text-white">{title}</p>
          </div>
          <div className={contentClassName || defaultContentClassName}>{children}</div>
        </div>
      </div>
    </section>
  );
};

export default SectionCard;
