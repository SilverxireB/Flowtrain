"use client";

import Rehber from "@/components/Rehber";
import { TRAIN_BOLUMLER } from "./trainIcerik";

/** Çekirdek çekmece kabuğu + FlowTrain içeriği. */
export default function TrainRehber({ bolum, onClose }: { bolum?: string; onClose: () => void }) {
  return (
    <Rehber
      baslik="FlowTrain rehberi"
      altBaslik="Hazırlamadan denetime, beş bölüm"
      bolumler={TRAIN_BOLUMLER}
      bolum={bolum}
      onClose={onClose}
    />
  );
}
