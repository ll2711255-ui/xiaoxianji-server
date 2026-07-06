import { defineStore } from 'pinia';
import { io, Socket } from 'socket.io-client';
import { ref } from 'vue';

export const useSocketStore = defineStore('socket', () => {
  const socket = ref<Socket | null>(null);
  const connected = ref(false);

  function connect() {
    if (socket.value?.connected) return;

    socket.value = io('/', {
      transports: ['websocket', 'polling'],
    });

    socket.value.on('connect', () => {
      connected.value = true;
      console.log('[ws] 已连接');
    });

    socket.value.on('disconnect', () => {
      connected.value = false;
    });
  }

  function join(room: string) {
    socket.value?.emit('join', room);
  }

  function leave(room: string) {
    socket.value?.emit('leave', room);
  }

  function onOrderNew(cb: (data: any) => void) {
    socket.value?.on('order:new', cb);
  }

  function onOrderPaid(cb: (data: any) => void) {
    socket.value?.on('order:paid', cb);
  }

  function onStockAlert(cb: (data: any) => void) {
    socket.value?.on('stock:alert', cb);
  }

  function disconnect() {
    socket.value?.disconnect();
    socket.value = null;
    connected.value = false;
  }

  return { socket, connected, connect, join, leave, onOrderNew, onOrderPaid, onStockAlert, disconnect };
});
