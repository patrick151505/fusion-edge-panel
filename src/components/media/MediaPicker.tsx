import { Modal } from "../ui/modal";
import MediaGrid from "./MediaGrid";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
};

/** A modal wrapper around MediaGrid for choosing (or uploading) an image. */
export default function MediaPicker({ isOpen, onClose, onPick }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl w-full p-6 max-h-[85vh] overflow-y-auto"
    >
      <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
        Media library
      </h3>
      <MediaGrid
        onPick={(url) => {
          onPick(url);
          onClose();
        }}
        allowDelete={false}
      />
    </Modal>
  );
}
