import torch
import torch.nn as nn
import torch.nn.functional as F

class TFTPatchTokenizer(nn.Module):
    """
    Extracts the patching logic from PatchTST to group N days of data into 
    single summary tokens for a Temporal Fusion Transformer (TFT).
    """
    def __init__(self, patch_len: int = 3, stride: int = 3, pool_mode: str = 'mean'):
        super().__init__()
        self.patch_len = patch_len
        self.stride = stride
        self.pool_mode = pool_mode

    def forward(self, z: torch.Tensor) -> torch.Tensor:
        z = z.permute(0, 2, 1)

        remainder = z.shape[-1] % self.patch_len
        if remainder != 0:
            pad_len = self.patch_len - remainder
            z = F.pad(z, (0, pad_len), mode='replicate')

        z = z.unfold(dimension=-1, size=self.patch_len, step=self.stride)

        if self.pool_mode == 'mean':
            z = z.mean(dim=-1)
        elif self.pool_mode == 'max':
            z, _ = z.max(dim=-1)

        z = z.permute(0, 2, 1)

        return z


