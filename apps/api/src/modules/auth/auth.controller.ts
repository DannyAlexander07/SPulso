import {
  Body,
  Controller,
  Get,
  Headers,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthUser } from './jwt-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { LoginDto } from './dto/login.dto';
import type { UpdateThemePreferenceDto } from './dto/update-theme-preference.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.authService.me(authorization);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user);
  }

  @Patch('theme')
  @UseGuards(JwtAuthGuard)
  updateTheme(
    @CurrentUser() user: AuthUser,
    @Body() updateThemeDto: UpdateThemePreferenceDto,
  ) {
    return this.authService.updateThemePreference(user, updateThemeDto);
  }
}
