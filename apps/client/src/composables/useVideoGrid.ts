import { computed, type Ref } from 'vue'

interface GridConfig {
  columns: number
  rows: number
  aspectRatio: string
}

export function useVideoGrid(participantCount: Ref<number>) {
  const gridConfig = computed((): GridConfig => {
    const count = participantCount.value

    if (count === 0) {
      return { columns: 1, rows: 1, aspectRatio: '16/9' }
    }

    if (count === 1) {
      return { columns: 1, rows: 1, aspectRatio: '16/9' }
    }

    if (count === 2) {
      return { columns: 2, rows: 1, aspectRatio: '16/9' }
    }

    if (count <= 4) {
      return { columns: 2, rows: 2, aspectRatio: '4/3' }
    }

    if (count <= 6) {
      return { columns: 3, rows: 2, aspectRatio: '4/3' }
    }

    if (count <= 9) {
      return { columns: 3, rows: 3, aspectRatio: '1/1' }
    }

    if (count <= 12) {
      return { columns: 4, rows: 3, aspectRatio: '4/3' }
    }

    if (count <= 16) {
      return { columns: 4, rows: 4, aspectRatio: '1/1' }
    }

    if (count <= 20) {
      return { columns: 5, rows: 4, aspectRatio: '4/3' }
    }

    const optimalCols = Math.ceil(Math.sqrt(count))
    const optimalRows = Math.ceil(count / optimalCols)

    return {
      columns: Math.min(optimalCols, 6),
      rows: Math.min(optimalRows, 5),
      aspectRatio: '4/3',
    }
  })

  return {
    gridConfig,
  }
}
