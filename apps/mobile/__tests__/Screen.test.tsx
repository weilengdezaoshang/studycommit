import { StyleSheet, Text } from 'react-native'
import { screen } from '@testing-library/react-native'
import { Screen } from '../src/components/Screen'
import { darkColors } from '@studycommit/design-tokens'
import {
  renderWithAppProviders,
  TEST_SAFE_AREA_METRICS,
} from '../src/test/render'

describe('<Screen />', () => {
  it('renders content inside deterministic safe-area insets', async () => {
    await renderWithAppProviders(
      <Screen testID="subject-screen">
        <Text>学习内容</Text>
      </Screen>,
    )

    expect(screen.getByText('学习内容')).toBeOnTheScreen()
    expect(screen.getByTestId('subject-screen')).toHaveStyle({
      paddingTop: TEST_SAFE_AREA_METRICS.insets.top,
      paddingBottom: TEST_SAFE_AREA_METRICS.insets.bottom,
    })
  })

  it('can leave the bottom inset to a future tab navigator', async () => {
    await renderWithAppProviders(
      <Screen includeBottomInset={false} testID="subject-screen" />,
    )

    expect(screen.getByTestId('subject-screen')).toHaveStyle({ paddingBottom: 0 })
  })

  it('uses the selected semantic background color', async () => {
    await renderWithAppProviders(<Screen testID="subject-screen" />, {
      colorScheme: 'dark',
    })

    const style = StyleSheet.flatten(screen.getByTestId('subject-screen').props.style)
    expect(style.backgroundColor).toBe(darkColors.background)
  })
})
