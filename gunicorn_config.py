import multiprocessing
import os

workers = 1
threads = 1
timeout = 300
keepalive = 5
worker_class = "sync"
max_requests = 1
max_requests_jitter = 0
worker_tmp_dir = "/dev/shm"

os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["TORCH_NUM_THREADS"] = "1"
