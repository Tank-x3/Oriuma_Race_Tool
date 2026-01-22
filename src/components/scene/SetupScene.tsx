import { RaceConfigForm } from './setup/RaceConfigForm';
import { EntryForm } from './setup/EntryForm';
export const SetupScene: React.FC = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2 mb-10">
                <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">レース準備</h2>
                <p className="text-slate-500 dark:text-slate-400">レース設定と参加者登録を行ってください。</p>
            </div>

            <div className="space-y-8">
                <RaceConfigForm />
                <EntryForm />
            </div>
        </div>
    );
};
