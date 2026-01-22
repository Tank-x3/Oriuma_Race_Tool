import React from 'react';
import { AlertCircle, Info } from 'lucide-react';

interface NotificationAreaProps {
    errors?: string[];
    defaultMessage?: React.ReactNode;
    className?: string;
}

export const NotificationArea: React.FC<NotificationAreaProps> = ({
    errors = [],
    defaultMessage = "ℹ️ レース設定を入力し、出走者を登録してください。",
    className = ""
}) => {
    const hasErrors = errors.length > 0;

    return (
        <div
            className={`w-full p-4 rounded-lg border transition-all duration-300 ${hasErrors
                ? 'bg-red-50 border-red-500 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
                } ${className}`}
        >
            <div className="flex items-start gap-3">
                {hasErrors ? (
                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0 text-red-600" />
                ) : (
                    <Info className="w-5 h-5 mt-0.5 shrink-0 text-blue-600" />
                )}

                <div className="flex-1">
                    {hasErrors ? (
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-red-900 mb-1">
                                以下のエラーを確認してください:
                            </span>
                            <ul className="list-disc pl-5 space-y-1 text-sm font-medium">
                                {errors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <p className="text-sm font-medium leading-6">
                            {defaultMessage}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};
