import UploadForm from "@/components/UploadForm";

export default function NewProjectPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Nowy projekt</h1>
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <UploadForm />
      </div>
    </div>
  );
}
